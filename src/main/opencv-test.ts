import cv from '@techstark/opencv-js';

export async function runOpenCVTest(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (cv.Mat) {
      resolve();
    } else {
      cv.onRuntimeInitialized = resolve;
    }
  });

  console.log('[OpenCV] Version:', cv.getBuildInformation().split('\n')[0]);

  // Create a 4x4 matrix filled with zeros
  const mat = new cv.Mat(4, 4, cv.CV_8UC1, new cv.Scalar(0));
  console.log('[OpenCV] Created Mat — rows:', mat.rows, 'cols:', mat.cols, 'type:', mat.type());

  // Set some pixel values
  mat.ucharPtr(0, 0)[0] = 42;
  mat.ucharPtr(1, 1)[0] = 128;
  mat.ucharPtr(3, 3)[0] = 255;

  console.log('[OpenCV] Pixel (0,0):', mat.ucharAt(0, 0));
  console.log('[OpenCV] Pixel (1,1):', mat.ucharAt(1, 1));
  console.log('[OpenCV] Pixel (3,3):', mat.ucharAt(3, 3));

  // Compute sum of all elements by iterating
  let total = 0;
  for (let r = 0; r < mat.rows; r++) {
    for (let c = 0; c < mat.cols; c++) {
      total += mat.ucharAt(r, c);
    }
  }
  console.log('[OpenCV] Sum of all elements:', total);

  mat.delete();
  console.log('[OpenCV] Test complete.');
}
