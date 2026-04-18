import * as ort from 'onnxruntime-node';
import cv from '@techstark/opencv-js';
import { join } from 'path';

const ASSETS_DIR = join(__dirname, '../../external/head-pose-estimation/assets');
const INPUT_SIZE = 128;

export interface Landmark {
  x: number;
  y: number;
}

let cachedSession: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (cachedSession) return cachedSession;
  cachedSession = await ort.InferenceSession.create(
    join(ASSETS_DIR, 'face_landmarks.onnx'),
    { executionProviders: ['cpu'] },
  );
  console.log('[LandmarkDetector] Loaded');
  return cachedSession;
}

export async function detectLandmarks(
  rgbaData: Uint8Array,
  srcWidth: number,
  srcHeight: number,
): Promise<Landmark[]> {
  const session = await getSession();

  // Resize to 128×128 and convert RGBA → RGB
  const srcMat = new cv.Mat(srcHeight, srcWidth, cv.CV_8UC4);
  srcMat.data.set(rgbaData);
  const rgbMat = new cv.Mat();
  cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);
  srcMat.delete();
  const resized = new cv.Mat();
  cv.resize(rgbMat, resized, new cv.Size(INPUT_SIZE, INPUT_SIZE));
  rgbMat.delete();

  // Build NHWC float32 tensor [1, 128, 128, 3] with raw 0-255 values
  const pixels = resized.data as Uint8Array;
  const tensorData = new Float32Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) tensorData[i] = pixels[i];
  resized.delete();

  const tensor = new ort.Tensor('float32', tensorData, [1, INPUT_SIZE, INPUT_SIZE, 3]);
  const outputs = await session.run({ image_input: tensor });
  const raw = outputs['dense_1'].data as Float32Array; // [136] normalised 0-1

  const landmarks: Landmark[] = [];
  for (let i = 0; i < 68; i++) {
    landmarks.push({
      x: raw[i * 2] * srcWidth,
      y: raw[i * 2 + 1] * srcHeight,
    });
  }
  return landmarks;
}
