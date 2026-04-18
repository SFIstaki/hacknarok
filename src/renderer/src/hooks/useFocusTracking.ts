import { useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FocusState } from '../i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const INFERENCE_MS = 500;

const GAZE_OFFSET_THRESHOLD = 0.32; // fraction from eye center — 0 = center, 0.5 = edge
const YAW_THRESHOLD = 0.28;
const EAR_THRESHOLD = 0.18;
const JAW_OPEN_THRESHOLD = 0.65;
const BEHAVIOR_SUSTAIN_FRAMES = 6; // ~3s at 500ms — avoids flickering the UI on brief glances

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
const L_LID_TOP = 159;
const L_LID_BOT = 145;

const WASM_URL = '/mediapipe-wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const ALERT_COOLDOWN_MS = 60_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type Landmark = { x: number; y: number; z: number };

export type Behavior = 'lookingAway' | 'headTurned' | 'eyesClosed' | 'yawning' | 'faceAbsent';

// Priority order for alert selection when multiple behaviors are active
const BEHAVIOR_PRIORITY: Behavior[] = [
  'faceAbsent',
  'eyesClosed',
  'yawning',
  'lookingAway',
  'headTurned',
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

  // Gaze: iris position as 0–1 ratio from the leftmost to rightmost eye corner.
  // 0.5 = looking straight. >0.5+threshold or <0.5-threshold = looking away.
  // We use min/max to avoid sign issues (L_EYE_OUT has smaller x than L_EYE_IN).
  const lLeft = Math.min(lm[L_EYE_OUT].x, lm[L_EYE_IN].x);
  const lRight = Math.max(lm[L_EYE_OUT].x, lm[L_EYE_IN].x);
  const lGaze = lRight > lLeft ? (lm[L_IRIS].x - lLeft) / (lRight - lLeft) : 0.5;

  const rLeft = Math.min(lm[R_EYE_IN].x, lm[R_EYE_OUT].x);
  const rRight = Math.max(lm[R_EYE_IN].x, lm[R_EYE_OUT].x);
  const rGaze = rRight > rLeft ? (lm[R_IRIS].x - rLeft) / (rRight - rLeft) : 0.5;

  const gazeOffset = Math.max(Math.abs(lGaze - 0.5), Math.abs(rGaze - 0.5));

  // Head yaw: nose tip vs cheek midpoint
  const cheekMidX = (lm[L_CHEEK].x + lm[R_CHEEK].x) / 2;
  const faceW = Math.abs(lm[R_CHEEK].x - lm[L_CHEEK].x) || 1;
  const yaw = Math.abs(lm[NOSE].x - cheekMidX) / faceW;

  // Eye Aspect Ratio
  const earV = Math.abs(lm[L_LID_TOP].y - lm[L_LID_BOT].y);
  const earH = Math.abs(lm[L_EYE_OUT].x - lm[L_EYE_IN].x) || 1;
  const ear = earV / earH;

  // Jaw open (yawning) from blendshapes
  const blendshapes = result.faceBlendshapes?.[0]?.categories;
  const jawOpen = blendshapes?.find((c) => c.categoryName === 'jawOpen')?.score ?? 0;

  const behaviors: Record<Behavior, boolean> = {
    faceAbsent: false,
    lookingAway: gazeOffset > GAZE_OFFSET_THRESHOLD,
    headTurned: yaw > YAW_THRESHOLD,
    eyesClosed: ear < EAR_THRESHOLD,
    yawning: jawOpen > JAW_OPEN_THRESHOLD,
  };

  const debug = {
    faceDetected: true,
    gazeOffset: +gazeOffset.toFixed(3),
    yaw: +yaw.toFixed(3),
    ear: +ear.toFixed(3),
    jawOpen: +jawOpen.toFixed(3),
    behaviors: Object.entries(behaviors)
      .filter(([, v]) => v)
      .map(([k]) => k),
  };

  return { behaviors, debug };
}

function behaviorsToFocusState(active: Set<Behavior>): FocusState {
  if (active.has('faceAbsent') || active.has('eyesClosed')) return 'gone';
  if (active.has('yawning') || active.has('lookingAway') || active.has('headTurned'))
    return 'fading';
  return 'locked';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFocusTracking(): FocusTrackingResult {
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

  // Per-behavior start timestamps (ms) — reset when behavior clears
  const behaviorSince = useRef<Partial<Record<Behavior, number>>>({});
  // Consecutive frame counter per behavior — focusState only updates after BEHAVIOR_SUSTAIN_FRAMES
  const behaviorFrames = useRef<Partial<Record<Behavior, number>>>({});
  const alertActiveRef = useRef(false);
  const alertDismissedAt = useRef<number | null>(null);
  const faceDetectedRef = useRef<boolean | null>(null);
  const prevFocusStateRef = useRef<FocusState>('locked');

  const stopTracking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    behaviorSince.current = {};
    behaviorFrames.current = {};
    faceDetectedRef.current = null;
    prevFocusStateRef.current = 'locked';
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

    // Log face detection changes
    const faceNow = !behaviors.faceAbsent;
    if (faceNow !== faceDetectedRef.current) {
      console.log(`[FocusTracking] Person ${faceNow ? 'detected ✅' : 'lost ❌'}`);
      faceDetectedRef.current = faceNow;
    }
    console.log('[FocusTracking]', debug);

    const now = Date.now();
    const rawActive = new Set<Behavior>(); // fires this frame
    const sustainedActive = new Set<Behavior>(); // sustained BEHAVIOR_SUSTAIN_FRAMES frames

    for (const beh of BEHAVIOR_PRIORITY) {
      if (behaviors[beh]) {
        if (!behaviorSince.current[beh]) behaviorSince.current[beh] = now;
        behaviorFrames.current[beh] = (behaviorFrames.current[beh] ?? 0) + 1;
        rawActive.add(beh);
        if ((behaviorFrames.current[beh] ?? 0) >= BEHAVIOR_SUSTAIN_FRAMES) {
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

    // Fire alert when focus transitions away from 'locked' (sustained, debounced by BEHAVIOR_SUSTAIN_FRAMES)
    const cooldownActive =
      alertDismissedAt.current !== null && now - alertDismissedAt.current < ALERT_COOLDOWN_MS;
    const justWentAway = prevFocusStateRef.current === 'locked' && newFocusState !== 'locked';
    prevFocusStateRef.current = newFocusState;

    if (!alertActiveRef.current && !cooldownActive && justWentAway) {
      // Pick the highest-priority sustained behavior for the alert
      for (const beh of BEHAVIOR_PRIORITY) {
        if (sustainedActive.has(beh)) {
          console.log(`[FocusTracking] Alert: ${beh} (focus → ${newFocusState})`);
          setAlertBehavior(beh);
          setAlertActive(true);
          alertActiveRef.current = true;
          window.api?.sendFocusAlert(beh);
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
    // Clear the since timer for the behavior that just alerted so it doesn't re-fire immediately
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
