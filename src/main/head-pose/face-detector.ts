import * as ort from 'onnxruntime-node';
import cv from '@techstark/opencv-js';
import { join } from 'path';

const ASSETS_DIR = join(__dirname, '../../external/head-pose-estimation/assets');
const INPUT_WIDTH = 320;
const INPUT_HEIGHT = 320;
const NMS_THRESHOLD = 0.4;
// 9 outputs → strides [8,16,32], 2 anchors per cell, offset 3
const STRIDES = [8, 16, 32];
const NUM_ANCHORS = 2;
const OFFSET = 3;

export interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
}

function distance2bbox(
  anchorCenters: Float32Array,
  bboxPreds: Float32Array,
  n: number,
): Float32Array {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const ax = anchorCenters[i * 2];
    const ay = anchorCenters[i * 2 + 1];
    out[i * 4 + 0] = ax - bboxPreds[i * 4 + 0];
    out[i * 4 + 1] = ay - bboxPreds[i * 4 + 1];
    out[i * 4 + 2] = ax + bboxPreds[i * 4 + 2];
    out[i * 4 + 3] = ay + bboxPreds[i * 4 + 3];
  }
  return out;
}

// Expects dets already sorted by score descending
function nms(dets: [number, number, number, number, number][]): number[] {
  const keep: number[] = [];
  const suppressed = new Uint8Array(dets.length);
  const areas = dets.map((d) => (d[2] - d[0] + 1) * (d[3] - d[1] + 1));

  for (let i = 0; i < dets.length; i++) {
    if (suppressed[i]) continue;
    keep.push(i);
    for (let j = i + 1; j < dets.length; j++) {
      if (suppressed[j]) continue;
      const ix1 = Math.max(dets[i][0], dets[j][0]);
      const iy1 = Math.max(dets[i][1], dets[j][1]);
      const ix2 = Math.min(dets[i][2], dets[j][2]);
      const iy2 = Math.min(dets[i][3], dets[j][3]);
      const w = Math.max(0, ix2 - ix1 + 1);
      const h = Math.max(0, iy2 - iy1 + 1);
      const inter = w * h;
      const ovr = inter / (areas[i] + areas[j] - inter);
      if (ovr > NMS_THRESHOLD) suppressed[j] = 1;
    }
  }
  return keep;
}

let cachedDetector: FaceDetector | null = null;

export class FaceDetector {
  private session: ort.InferenceSession;
  private inputName: string;
  private outputNames: string[];
  private centerCache = new Map<string, Float32Array>();

  private constructor(session: ort.InferenceSession) {
    this.session = session;
    this.inputName = session.inputNames[0];
    this.outputNames = [...session.outputNames];
  }

  static async get(): Promise<FaceDetector> {
    if (cachedDetector) return cachedDetector;
    const session = await ort.InferenceSession.create(
      join(ASSETS_DIR, 'face_detector.onnx'),
      { executionProviders: ['cpu'] },
    );
    cachedDetector = new FaceDetector(session);
    console.log('[FaceDetector] Loaded — input:', session.inputNames, 'outputs:', session.outputNames.length);
    return cachedDetector;
  }

  private getAnchorCenters(h: number, w: number, stride: number): Float32Array {
    const key = `${h}_${w}_${stride}`;
    if (this.centerCache.has(key)) return this.centerCache.get(key)!;

    const centers = new Float32Array(h * w * NUM_ANCHORS * 2);
    let idx = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let a = 0; a < NUM_ANCHORS; a++) {
          centers[idx++] = x * stride;
          centers[idx++] = y * stride;
        }
      }
    }
    this.centerCache.set(key, centers);
    return centers;
  }

  private preprocess(
    rgbaData: Uint8Array,
    srcWidth: number,
    srcHeight: number,
  ): { tensor: ort.Tensor; scale: number } {
    // Letterbox: fit image into INPUT_WIDTH x INPUT_HEIGHT preserving aspect ratio
    const ratioImg = srcHeight / srcWidth;
    const ratioModel = INPUT_HEIGHT / INPUT_WIDTH;
    let newWidth: number, newHeight: number;
    if (ratioImg > ratioModel) {
      newHeight = INPUT_HEIGHT;
      newWidth = Math.round(newHeight / ratioImg);
    } else {
      newWidth = INPUT_WIDTH;
      newHeight = Math.round(newWidth * ratioImg);
    }
    const scale = newHeight / srcHeight;

    const srcMat = new cv.Mat(srcHeight, srcWidth, cv.CV_8UC4);
    srcMat.data.set(rgbaData);

    const rgbMat = new cv.Mat();
    cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);
    srcMat.delete();

    const resized = new cv.Mat();
    cv.resize(rgbMat, resized, new cv.Size(newWidth, newHeight));
    rgbMat.delete();

    const padded = new cv.Mat(INPUT_HEIGHT, INPUT_WIDTH, cv.CV_8UC3, new cv.Scalar(0, 0, 0));
    const roi = padded.roi(new cv.Rect(0, 0, newWidth, newHeight));
    resized.copyTo(roi);
    roi.delete();
    resized.delete();

    // Build NCHW float32 tensor while padded is still alive
    const pixels = padded.data as Uint8Array;
    const planeSize = INPUT_HEIGHT * INPUT_WIDTH;
    const tensorData = new Float32Array(3 * planeSize);
    for (let i = 0; i < planeSize; i++) {
      tensorData[0 * planeSize + i] = (pixels[i * 3 + 0] - 127.5) / 128; // R
      tensorData[1 * planeSize + i] = (pixels[i * 3 + 1] - 127.5) / 128; // G
      tensorData[2 * planeSize + i] = (pixels[i * 3 + 2] - 127.5) / 128; // B
    }
    padded.delete();

    return {
      tensor: new ort.Tensor('float32', tensorData, [1, 3, INPUT_HEIGHT, INPUT_WIDTH]),
      scale,
    };
  }

  async detect(
    rgbaData: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    threshold = 0.5,
  ): Promise<Detection[]> {
    const { tensor, scale } = this.preprocess(rgbaData, srcWidth, srcHeight);
    const outputs = await this.session.run({ [this.inputName]: tensor });

    const allDets: [number, number, number, number, number][] = [];

    for (let s = 0; s < STRIDES.length; s++) {
      const stride = STRIDES[s];
      const h = INPUT_HEIGHT / stride;
      const w = INPUT_WIDTH / stride;
      const n = h * w * NUM_ANCHORS;

      const scoresData = outputs[this.outputNames[s]].data as Float32Array;         // [n, 1]
      const bboxData = outputs[this.outputNames[s + OFFSET]].data as Float32Array;  // [n, 4]

      const scaledBbox = new Float32Array(n * 4);
      for (let i = 0; i < n * 4; i++) scaledBbox[i] = bboxData[i] * stride;

      const anchors = this.getAnchorCenters(h, w, stride);
      const bboxes = distance2bbox(anchors, scaledBbox, n);

      for (let i = 0; i < n; i++) {
        const score = scoresData[i];
        if (score < threshold) continue;
        allDets.push([
          bboxes[i * 4 + 0] / scale,
          bboxes[i * 4 + 1] / scale,
          bboxes[i * 4 + 2] / scale,
          bboxes[i * 4 + 3] / scale,
          score,
        ]);
      }
    }

    if (allDets.length === 0) return [];

    allDets.sort((a, b) => b[4] - a[4]);
    const keep = nms(allDets);

    return keep.map((i) => ({
      x1: allDets[i][0],
      y1: allDets[i][1],
      x2: allDets[i][2],
      y2: allDets[i][3],
      score: allDets[i][4],
    }));
  }
}
