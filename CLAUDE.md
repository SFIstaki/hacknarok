# Presently — Developer Notes

## Project Overview

Electron app (electron-vite + React + TypeScript) that monitors user focus by tracking the active window. The main process runs native analysis; the renderer is a React SPA with a sidebar nav.

Key directories:
- `src/main/` — Electron main process (Node.js context)
- `src/renderer/src/` — React frontend
- `external/head-pose-estimation/` — Git submodule containing ONNX models and reference Python implementation

---

## What Has Been Built

### OpenCV in the Main Process

**Package:** `@techstark/opencv-js` (WASM build, works in Node.js)

**File:** `src/main/opencv-test.ts`

Smoke-test that runs on startup: initialises the WASM runtime, creates a `CV_8UC1` Mat, reads/writes pixels, then cleans up. Verifies OpenCV is operational before we do real frame processing.

Key pattern — wait for WASM init before using the API:
```ts
await new Promise<void>((resolve) => {
  if (cv.Mat) resolve();
  else cv.onRuntimeInitialized = resolve;
});
```

`cv.sumElems` does not exist in the JS bindings; iterate manually to sum pixels.

### ONNX Runtime in the Main Process

**Package:** `onnxruntime-node` v1.24.3

**File:** `src/main/head-pose/model-loader.ts`

Loads both models at startup (lazily cached in module scope):

| Model | File | Input | Output |
|---|---|---|---|
| Face detector | `face_detector.onnx` | image tensor | bounding boxes + keypoints |
| Facial landmark detector | `face_landmarks.onnx` | `image_input` — batch of 128×128 RGB images | `dense_1` — `[batch, 136]` (68 landmarks × xy) |

Execution provider: `cpu`.

**Path resolution:** `__dirname` at runtime is `out/main/`. The models live at `external/head-pose-estimation/assets/`, which is `../../external/...` relative to `out/main/`. Using more `../` segments overshoots the project root.

**Submodule LFS:** the `.onnx` files are tracked by Git LFS inside the submodule. To pull them:
```bash
cd external/head-pose-estimation
git lfs pull
```
Running `git lfs pull` from the repo root does nothing because the outer repo has no LFS objects.

### Camera View in the Renderer

**New page:** `src/renderer/src/pages/Camera.tsx`

Uses `navigator.mediaDevices.getUserMedia({ video: true, audio: false })` to open the default camera and render the stream into a `<video>` element. The stream is stopped on component unmount.

**Nav integration:**
- `src/renderer/src/types.ts` — `Page` union extended with `'camera'`
- `src/renderer/src/components/Layout.tsx` — `CameraIcon` (SVG, same stroke style as all other nav icons), added to `navItems` array, and `case 'camera'` added to `renderPage`
- `src/renderer/src/assets/main.css` — `.camera-page`, `.camera-feed`, `.camera-error` styles appended

---

## Next Direction: Per-Frame Landmark Inference

The goal is to capture frames from the live camera feed at **5 fps**, run each frame through the facial landmark model, and overlay the resulting 68 landmark points on the video.

### Architecture plan

The inference will run in the **main process** (Node.js) because `onnxruntime-node` and `@techstark/opencv-js` live there. The renderer captures frames and sends raw pixel data over IPC; the main process returns landmark coordinates.

**Frame capture (renderer side)**
- Use `setInterval` at 200 ms (5 fps) inside `Camera.tsx`
- Draw the current video frame onto a hidden `<canvas>`, then call `canvas.toBlob()` or `getImageData()` to extract raw pixels
- Send the pixel buffer to the main process via `ipcRenderer.invoke`

**Inference (main process side)**
- Receive the pixel buffer
- Use OpenCV (`cv.Mat`, `cv.resize`, `cv.cvtColor`) to resize to 128×128 and convert BGR→RGB to match the model's expected preprocessing (see `mark_detection.py: _preprocess`)
- Build an `ort.Tensor` of shape `[1, 128, 128, 3]` with dtype `float32`
- Run `faceLandmarks.run({ image_input: tensor })` → output `dense_1` is `Float32Array` of length 136 (68 pairs of normalised x,y)
- Return the flat array to the renderer

**Landmark overlay (renderer side)**
- Draw the 136 values as dots on a `<canvas>` overlaid on the `<video>` element
