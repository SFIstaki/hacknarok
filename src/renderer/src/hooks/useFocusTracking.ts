import { useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { FocusState } from '../i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const INFERENCE_MS = 500;

const GAZE_OFFSET_THRESHOLD = 0.25;
const YAW_THRESHOLD = 0.16;
const EAR_THRESHOLD = 0.18;
const JAW_OPEN_THRESHOLD = 0.6; // blendshape score for yawning

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

// How many seconds each behavior must persist before triggering an alert.
// alertSens comes from user preferences (Low=60, Medium=30, High=10).
function behaviorThreshold(b: Behavior, alertSens: number): number {
  switch (b) {
    case 'faceAbsent':
      return 8;
    case 'eyesClosed':
      return 4;
    case 'yawning':
      return 3;
    case 'lookingAway':
      return alertSens;
    case 'headTurned':
      return alertSens;
  }
}

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

  // Gaze: iris offset ratio within eye bounds
  const lGaze = (lm[L_IRIS].x - lm[L_EYE_IN].x) / (Math.abs(lm[L_EYE_OUT].x - lm[L_EYE_IN].x) || 1);
  const rGaze = (lm[R_IRIS].x - lm[R_EYE_IN].x) / (Math.abs(lm[R_EYE_OUT].x - lm[R_EYE_IN].x) || 1);
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

export function useFocusTracking(alertSensitivitySeconds: number): FocusTrackingResult {
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
  const alertActiveRef = useRef(false); // sync ref to avoid stale closure in loop
  const alertDismissedAt = useRef<number | null>(null);
  const faceDetectedRef = useRef<boolean | null>(null); // previous detection state for change logs

  const stopTracking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    behaviorSince.current = {};
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
    console.log('[FocusTracking]', debug);

    const now = Date.now();
    const newActive = new Set<Behavior>();

    for (const beh of BEHAVIOR_PRIORITY) {
      if (behaviors[beh]) {
        if (!behaviorSince.current[beh]) behaviorSince.current[beh] = now;
        newActive.add(beh);
      } else {
        delete behaviorSince.current[beh];
      }
    }

    setActiveBehaviors(newActive);
    setFocusState(behaviorsToFocusState(newActive));

    // Fire alert for the highest-priority active behavior that has exceeded its threshold
    const cooldownActive =
      alertDismissedAt.current !== null && now - alertDismissedAt.current < ALERT_COOLDOWN_MS;
    if (!alertActiveRef.current && !cooldownActive) {
      for (const beh of BEHAVIOR_PRIORITY) {
        if (!newActive.has(beh)) continue;
        const since = behaviorSince.current[beh];
        if (!since) continue;
        const elapsed = (now - since) / 1000;
        const threshold = behaviorThreshold(beh, alertSensitivitySeconds);
        if (elapsed >= threshold) {
          console.log(`[FocusTracking] Alert: ${beh} for ${elapsed.toFixed(1)}s`);
          setAlertBehavior(beh);
          setAlertActive(true);
          alertActiveRef.current = true;
          if (document.hidden && window.api?.sendFocusAlert) {
            window.api.sendFocusAlert(beh, Math.round(elapsed));
          }
          break;
        }
      }
    }
  }, [alertSensitivitySeconds]);

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
