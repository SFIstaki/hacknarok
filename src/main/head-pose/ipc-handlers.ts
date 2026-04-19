import { ipcMain } from 'electron';
import cv from '@techstark/opencv-js';
import { FaceDetector, type Detection } from './face-detector';
import { detectLandmarks, type Landmark } from './landmark-detector';
import { estimatePose, type PoseResult } from './pose-estimator';

// Port of utils.py refine(): shifts box down 10%, squares it, clips to image bounds
function refineFace(
  det: Detection,
  maxWidth: number,
  maxHeight: number,
  shift = 0.1,
): { x1: number; y1: number; x2: number; y2: number } {
  const w = det.x2 - det.x1;
  const h = det.y2 - det.y1;
  const cx = (det.x1 + det.x2) / 2;
  const cy = (det.y1 + det.y2) / 2 + h * shift;
  const half = Math.max(w, h) / 2;
  return {
    x1: Math.max(0, Math.round(cx - half)),
    y1: Math.max(0, Math.round(cy - half)),
    x2: Math.min(maxWidth, Math.round(cx + half)),
    y2: Math.min(maxHeight, Math.round(cy + half)),
  };
}

// Crop a region out of a full-frame RGBA buffer using OpenCV (handles non-contiguous rows)
function extractCrop(
  rgba: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Uint8Array | null {
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return null;

  const full = new cv.Mat(fullHeight, fullWidth, cv.CV_8UC4);
  full.data.set(rgba);
  const roi = full.roi(new cv.Rect(x1, y1, w, h));
  const crop = new cv.Mat();
  roi.copyTo(crop);
  roi.delete();
  full.delete();

  const out = new Uint8Array(crop.data); // copy before delete
  crop.delete();
  return out;
}

export function registerHeadPoseHandlers(): void {
  ipcMain.handle(
    'headpose:detect',
    async (
      _,
      payload: { data: Uint8Array; width: number; height: number },
    ): Promise<PoseResult | null> => {
      // Step 1: detect face
      const detector = await FaceDetector.get();
      const detections = await detector.detect(payload.data, payload.width, payload.height);
      if (detections.length === 0) return null;

      // Step 2: refine bbox (shift + square)
      const { x1, y1, x2, y2 } = refineFace(detections[0], payload.width, payload.height);
      const squareSize = x2 - x1; // square after refine, so width == height

      // Step 3: crop face patch
      const cropData = extractCrop(payload.data, payload.width, payload.height, x1, y1, x2, y2);
      if (!cropData) return null;

      // Step 4: detect 68 landmarks on the face patch
      // landmark-detector scales output by (srcWidth, srcHeight), both = squareSize here
      const localLandmarks = await detectLandmarks(cropData, squareSize, squareSize);

      // Step 5: convert from patch-local to global image coords (matches Python's marks *= size + offset)
      const globalLandmarks: Landmark[] = localLandmarks.map((pt) => ({
        x: pt.x + x1,
        y: pt.y + y1,
      }));

      // Step 6: solvePnP → project Z-axis
      return estimatePose(globalLandmarks, payload.width, payload.height);
    },
  );
}
