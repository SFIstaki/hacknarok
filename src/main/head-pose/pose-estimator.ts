import cv from '@techstark/opencv-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Landmark } from './landmark-detector';

const ASSETS_DIR = join(__dirname, '../../external/head-pose-estimation/assets');

export interface PoseResult {
  lineStart: { x: number; y: number };
  lineEnd: { x: number; y: number };
}

// 204 values: reshape(3,68).T → (68,3), then z *= -1
let modelPoints68: number[] | null = null;

function getModelPoints(): number[] {
  if (modelPoints68) return modelPoints68;
  const raw = readFileSync(join(ASSETS_DIR, 'model.txt'), 'utf-8')
    .trim()
    .split('\n')
    .map(Number);
  // raw[0..67]=x, raw[68..135]=y, raw[136..203]=z
  const pts: number[] = [];
  for (let i = 0; i < 68; i++) {
    pts.push(raw[i]);         // x
    pts.push(raw[68 + i]);    // y
    pts.push(-raw[136 + i]);  // z flipped, positive = toward camera
  }
  modelPoints68 = pts;
  return pts;
}

// Persistent initial guess — updated each frame for fast convergence
let rvecGuess = [0.01891013, 0.08560084, -3.14392813];
let tvecGuess = [-14.97821226, -10.62040383, -2053.03596872];

export function estimatePose(
  landmarks: Landmark[],
  imageWidth: number,
  imageHeight: number,
): PoseResult | null {
  if (landmarks.length !== 68) return null;

  const modelPts = getModelPoints();

  // Approximate pinhole camera: focal length = image width, principal point = center
  const f = imageWidth;
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;

  // Object points [68 x 1] CV_64FC3
  const objPts = new cv.Mat(68, 1, cv.CV_64FC3);
  const objData = objPts.data64F;
  for (let i = 0; i < 68; i++) {
    objData[i * 3 + 0] = modelPts[i * 3 + 0];
    objData[i * 3 + 1] = modelPts[i * 3 + 1];
    objData[i * 3 + 2] = modelPts[i * 3 + 2];
  }

  // Image points [68 x 1] CV_64FC2
  const imgPts = new cv.Mat(68, 1, cv.CV_64FC2);
  const imgData = imgPts.data64F;
  for (let i = 0; i < 68; i++) {
    imgData[i * 2 + 0] = landmarks[i].x;
    imgData[i * 2 + 1] = landmarks[i].y;
  }

  const camMat = cv.matFromArray(3, 3, cv.CV_64F, [f, 0, cx, 0, f, cy, 0, 0, 1]);
  const distCoeffs = cv.matFromArray(4, 1, cv.CV_64F, [0, 0, 0, 0]);
  const rvec = cv.matFromArray(3, 1, cv.CV_64F, rvecGuess);
  const tvec = cv.matFromArray(3, 1, cv.CV_64F, tvecGuess);

  let result: PoseResult | null = null;

  try {
    cv.solvePnP(objPts, imgPts, camMat, distCoeffs, rvec, tvec, true);

    // Persist updated guess for next frame
    rvecGuess = Array.from(rvec.data64F);
    tvecGuess = Array.from(tvec.data64F);

    // Project Z-axis: origin (0,0,0) → line start; (0,0,500) → line end
    // Positive Z = toward camera after model.txt Z-flip
    const axisPts = new cv.Mat(2, 1, cv.CV_64FC3);
    const axisData = axisPts.data64F;
    axisData[0] = 0; axisData[1] = 0; axisData[2] = 0;
    axisData[3] = 0; axisData[4] = 0; axisData[5] = 500;

    const projPts = new cv.Mat();
    const jacobian = new cv.Mat();
    cv.projectPoints(axisPts, rvec, tvec, camMat, distCoeffs, projPts, jacobian);

    const d = projPts.data64F;
    result = {
      lineStart: { x: d[0], y: d[1] },
      lineEnd:   { x: d[2], y: d[3] },
    };

    jacobian.delete();
    projPts.delete();
    axisPts.delete();
  } catch (err) {
    console.error('[PoseEstimator] solvePnP failed:', err);
  }

  rvec.delete();
  tvec.delete();
  distCoeffs.delete();
  camMat.delete();
  imgPts.delete();
  objPts.delete();

  return result;
}
