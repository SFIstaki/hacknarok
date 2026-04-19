import { useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FocusState, Lang } from '../i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const INFERENCE_MS = 200; // faster polling for snappier response

// Gaze: iris X offset ratio from eye center (0.5 = straight)
const GAZE_OFFSET_THRESHOLD = 0.18;

// Face transformation matrix (radians) — used when matrix is available
const YAW_GONE_RAD = 0.25; // ~14° sideways → gone
const PITCH_GONE_RAD = 0.28; // ~16° chin-down (phone) → gone
const PITCH_FADING_RAD = 0.1; // ~6° slight tilt → fading

// Fallback landmark-based yaw (when matrix unavailable)
const YAW_FALLBACK_THRESHOLD = 0.18;

// Blendshape thresholds
const BLINK_THRESHOLD = 0.25; // eyeBlinkLeft/Right average — replaces EAR
const JAW_OPEN_THRESHOLD = 0.4;

// Per-behavior sustain before it counts as active (~frames × INFERENCE_MS)
const BEHAVIOR_SUSTAIN: Record<Behavior, number> = {
  faceAbsent: 1, // instant
  eyesClosed: 2, // ~0.4s
  headTurned: 1, // instant
  yawning: 2, // ~0.4s
  lookingAway: 3, // ~0.6s
};

// Landmark indices (MediaPipe 478-point model)
const L_IRIS = 468;
const R_IRIS = 473;
const L_EYE_OUT = 33;
const L_EYE_IN = 133;
const R_EYE_IN = 362;
const R_EYE_OUT = 263;
const NOSE = 1;
const L_CHEEK = 234;
const R_CHEEK = 454;

const WASM_URL = '/mediapipe-wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const GONE_ALERT_DELAY_MS = 500; // fire alert after this many ms in gone/fading state
const ALERT_COOLDOWN_MS = 15_000; // minimum gap between alerts after dismissal

// ─── Types ────────────────────────────────────────────────────────────────────

type Landmark = { x: number; y: number; z: number };

export type Behavior = 'lookingAway' | 'headTurned' | 'eyesClosed' | 'yawning' | 'faceAbsent';

const BEHAVIOR_PRIORITY: Behavior[] = [
  'faceAbsent',
  'eyesClosed',
  'headTurned',
  'yawning',
  'lookingAway',
];

export interface FocusTrackingResult {
  focusState: FocusState;
  activeBehaviors: Set<Behavior>;
  alertActive: boolean;
  alertBehavior: Behavior | null;
  isTracking: boolean;
  isLoading: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  dismissAlert: () => void;
}

// ─── Head pose from face transformation matrix ────────────────────────────────

interface HeadAngles {
  yaw: number; // radians, abs value — left/right turn
  pitch: number; // radians, signed — negative = chin down (phone), positive = chin up
}

function extractHeadAngles(result: FaceLandmarkerResult): HeadAngles | null {
  const mat = result.facialTransformationMatrixes?.[0]?.data;
  if (!mat || mat.length < 16) return null;
  // Column-major 4×4. Rotation submatrix (row-major view):
  //   R[i][j] = mat[j*4 + i]
  // pitch (X rotation): asin(-R[1][2]) = asin(-mat[9])
  // yaw   (Y rotation): atan2(R[0][2], R[2][2]) = atan2(mat[8], mat[10])
  const pitch = Math.asin(Math.max(-1, Math.min(1, -mat[9])));
  const yaw = Math.atan2(mat[8], mat[10]);
  return { yaw: Math.abs(yaw), pitch };
}

// ─── Frame analysis ───────────────────────────────────────────────────────────

interface FrameResult {
  behaviors: Record<Behavior, boolean>;
  debug: object;
}

function analyzeFrame(result: FaceLandmarkerResult): FrameResult {
  if (!result.faceLandmarks?.length) {
    return {
      behaviors: {
        faceAbsent: true,
        lookingAway: false,
        headTurned: false,
        eyesClosed: false,
        yawning: false,
      },
      debug: { faceDetected: false },
    };
  }

  const lm: Landmark[] = result.faceLandmarks[0];
  const blendshapes = result.faceBlendshapes?.[0]?.categories;

  // ── Gaze (iris X position within each eye) ──
  const lLeft = Math.min(lm[L_EYE_OUT].x, lm[L_EYE_IN].x);
  const lRight = Math.max(lm[L_EYE_OUT].x, lm[L_EYE_IN].x);
  const lGaze = lRight > lLeft ? (lm[L_IRIS].x - lLeft) / (lRight - lLeft) : 0.5;

  const rLeft = Math.min(lm[R_EYE_IN].x, lm[R_EYE_OUT].x);
  const rRight = Math.max(lm[R_EYE_IN].x, lm[R_EYE_OUT].x);
  const rGaze = rRight > rLeft ? (lm[R_IRIS].x - rLeft) / (rRight - rLeft) : 0.5;

  const gazeOffset = Math.max(Math.abs(lGaze - 0.5), Math.abs(rGaze - 0.5));

  // ── Eye closure via blendshapes (more accurate than raw EAR) ──
  const blinkL = blendshapes?.find((c) => c.categoryName === 'eyeBlinkLeft')?.score ?? 0;
  const blinkR = blendshapes?.find((c) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
  const blinkScore = (blinkL + blinkR) / 2;

  // ── Yawning ──
  const jawOpen = blendshapes?.find((c) => c.categoryName === 'jawOpen')?.score ?? 0;

  // ── Head pose ──
  // Prefer matrix-based angles; fall back to landmark heuristic when unavailable.
  const headAngles = extractHeadAngles(result);

  let headTurned: boolean;
  let lookingAwayFromPose: boolean;

  if (headAngles) {
    headTurned = headAngles.yaw > YAW_GONE_RAD || headAngles.pitch < -PITCH_GONE_RAD; // chin far down = phone
    lookingAwayFromPose = Math.abs(headAngles.pitch) > PITCH_FADING_RAD;
  } else {
    // Landmark fallback: nose vs cheek midpoint
    const cheekMidX = (lm[L_CHEEK].x + lm[R_CHEEK].x) / 2;
    const faceW = Math.abs(lm[R_CHEEK].x - lm[L_CHEEK].x) || 1;
    const yawFallback = Math.abs(lm[NOSE].x - cheekMidX) / faceW;
    headTurned = yawFallback > YAW_FALLBACK_THRESHOLD;
    lookingAwayFromPose = false;
  }

  const behaviors: Record<Behavior, boolean> = {
    faceAbsent: false,
    lookingAway: gazeOffset > GAZE_OFFSET_THRESHOLD || lookingAwayFromPose,
    headTurned,
    eyesClosed: blinkScore > BLINK_THRESHOLD,
    yawning: jawOpen > JAW_OPEN_THRESHOLD,
  };

  const debug = {
    faceDetected: true,
    gazeOffset: +gazeOffset.toFixed(3),
    blinkScore: +blinkScore.toFixed(3),
    jawOpen: +jawOpen.toFixed(3),
    headAngles: headAngles
      ? {
          yawDeg: +(headAngles.yaw * (180 / Math.PI)).toFixed(1),
          pitchDeg: +(headAngles.pitch * (180 / Math.PI)).toFixed(1),
        }
      : null,
    behaviors: Object.entries(behaviors)
      .filter(([, v]) => v)
      .map(([k]) => k),
  };

  return { behaviors, debug };
}

function behaviorsToFocusState(active: Set<Behavior>): FocusState {
  if (active.has('faceAbsent') || active.has('eyesClosed') || active.has('headTurned'))
    return 'gone';
  if (active.has('yawning') || active.has('lookingAway')) return 'fading';
  return 'locked';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFocusTracking(lang: Lang = 'en'): FocusTrackingResult {
  const [focusState, setFocusState] = useState<FocusState>('locked');
  const [activeBehaviors, setActiveBehaviors] = useState<Set<Behavior>>(new Set());
  const [alertActive, setAlertActive] = useState(false);
  const [alertBehavior, setAlertBehavior] = useState<Behavior | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);

  const behaviorSince = useRef<Partial<Record<Behavior, number>>>({});
  const behaviorFrames = useRef<Partial<Record<Behavior, number>>>({});
  const alertActiveRef = useRef(false);
  const alertDismissedAt = useRef<number | null>(null);
  const faceDetectedRef = useRef<boolean | null>(null);
  const goneSinceRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    behaviorSince.current = {};
    behaviorFrames.current = {};
    faceDetectedRef.current = null;
    goneSinceRef.current = null;
    startingRef.current = false;
    alertActiveRef.current = false;
    setIsTracking(false);
    setAlertActive(false);
    setAlertBehavior(null);
    setActiveBehaviors(new Set());
  }, []);

  const runInferenceLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) return;

    const result = landmarker.detectForVideo(video, performance.now());
    const { behaviors, debug } = analyzeFrame(result);

    const faceNow = !behaviors.faceAbsent;
    if (faceNow !== faceDetectedRef.current) {
      console.log(`[FocusTracking] Person ${faceNow ? 'detected ✅' : 'lost ❌'}`);
      faceDetectedRef.current = faceNow;
    }
    console.log('[FocusTracking]', debug);

    const now = Date.now();
    const sustainedActive = new Set<Behavior>();

    for (const beh of BEHAVIOR_PRIORITY) {
      if (behaviors[beh]) {
        if (!behaviorSince.current[beh]) behaviorSince.current[beh] = now;
        behaviorFrames.current[beh] = (behaviorFrames.current[beh] ?? 0) + 1;
        if ((behaviorFrames.current[beh] ?? 0) >= BEHAVIOR_SUSTAIN[beh]) {
          sustainedActive.add(beh);
        }
      } else {
        delete behaviorSince.current[beh];
        delete behaviorFrames.current[beh];
      }
    }

    setActiveBehaviors(sustainedActive);
    const newFocusState = behaviorsToFocusState(sustainedActive);
    setFocusState(newFocusState);

    // Track how long we've been continuously in gone or fading state
    if (newFocusState === 'gone' || newFocusState === 'fading') {
      if (goneSinceRef.current === null) goneSinceRef.current = now;
    } else {
      goneSinceRef.current = null;
    }

    const cooldownActive =
      alertDismissedAt.current !== null && now - alertDismissedAt.current < ALERT_COOLDOWN_MS;
    const goneEnough =
      (newFocusState === 'gone' || newFocusState === 'fading') &&
      goneSinceRef.current !== null &&
      now - goneSinceRef.current >= GONE_ALERT_DELAY_MS;

    if (!alertActiveRef.current && !cooldownActive && goneEnough) {
      for (const beh of BEHAVIOR_PRIORITY) {
        if (sustainedActive.has(beh)) {
          console.log(`[FocusTracking] Alert: ${beh} (gone for ${now - goneSinceRef.current!}ms)`);
          setAlertBehavior(beh);
          setAlertActive(true);
          alertActiveRef.current = true;
          goneSinceRef.current = null; // require a fresh 3s gone period for the next alert
          window.api?.sendFocusAlert(beh, lang);
          break;
        }
      }
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) {
          resolve();
          return;
        }
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      });
      await video.play().catch((err) => console.warn('[FocusTracking] play():', err));

      if (!landmarkerRef.current) {
        console.log('[FocusTracking] Loading MediaPipe model…');
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        console.log('[FocusTracking] Model ready.');
      }

      setIsTracking(true);
      intervalRef.current = setInterval(runInferenceLoop, INFERENCE_MS);
    } catch (err) {
      console.error('[FocusTracking] Failed to start:', err);
    } finally {
      setIsLoading(false);
      startingRef.current = false;
    }
  }, [runInferenceLoop]);

  const dismissAlert = useCallback(() => {
    alertActiveRef.current = false;
    alertDismissedAt.current = Date.now();
    if (alertBehavior) delete behaviorSince.current[alertBehavior];
    setAlertActive(false);
    setAlertBehavior(null);
  }, [alertBehavior]);

  return {
    focusState,
    activeBehaviors,
    alertActive,
    alertBehavior,
    isTracking,
    isLoading,
    videoRef,
    startTracking,
    stopTracking,
    dismissAlert,
  };
}
