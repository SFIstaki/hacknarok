import * as ort from 'onnxruntime-node';
import { join } from 'path';

const ASSETS_DIR = join(__dirname, '../../external/head-pose-estimation/assets');

export interface HeadPoseModels {
  faceDetector: ort.InferenceSession;
  faceLandmarks: ort.InferenceSession;
}

let models: HeadPoseModels | null = null;

export async function loadHeadPoseModels(): Promise<HeadPoseModels> {
  if (models) return models;

  const [faceDetector, faceLandmarks] = await Promise.all([
    ort.InferenceSession.create(join(ASSETS_DIR, 'face_detector.onnx'), {
      executionProviders: ['cpu'],
    }),
    ort.InferenceSession.create(join(ASSETS_DIR, 'face_landmarks.onnx'), {
      executionProviders: ['cpu'],
    }),
  ]);

  console.log('[ONNX] face_detector inputs:', faceDetector.inputNames, '→ outputs:', faceDetector.outputNames);
  console.log('[ONNX] face_landmarks inputs:', faceLandmarks.inputNames, '→ outputs:', faceLandmarks.outputNames);

  models = { faceDetector, faceLandmarks };
  return models;
}
