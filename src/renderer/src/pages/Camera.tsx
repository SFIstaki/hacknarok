import { useEffect, useRef, useState } from 'react';

export default function Camera(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let busy = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;

        intervalId = setInterval(async () => {
          if (busy) return;
          const video = videoRef.current;
          const capture = captureRef.current;
          const overlay = overlayRef.current;
          if (!video || !capture || !overlay || video.readyState < 2) return;

          busy = true;
          try {
            const { videoWidth, videoHeight } = video;

            // Sync canvas internal dimensions to video resolution
            if (capture.width !== videoWidth) capture.width = videoWidth;
            if (capture.height !== videoHeight) capture.height = videoHeight;
            if (overlay.width !== videoWidth) overlay.width = videoWidth;
            if (overlay.height !== videoHeight) overlay.height = videoHeight;

            const ctx = capture.getContext('2d')!;
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
            const rgba = new Uint8Array(imageData.data.buffer);

            const pose = await window.api.detectFaces({
              data: rgba,
              width: videoWidth,
              height: videoHeight,
            });

            const octx = overlay.getContext('2d')!;
            octx.clearRect(0, 0, videoWidth, videoHeight);
            if (pose) {
              octx.beginPath();
              octx.moveTo(pose.lineStart.x, pose.lineStart.y);
              octx.lineTo(pose.lineEnd.x, pose.lineEnd.y);
              octx.strokeStyle = '#00ff00';
              octx.lineWidth = 3;
              octx.lineCap = 'round';
              octx.stroke();
            }
          } catch {
            // skip frame on inference error
          } finally {
            busy = false;
          }
        }, 200); // 5 fps
      })
      .catch((err) => setError(err.message));

    return () => {
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="page-content camera-page">
      {error ? (
        <p className="camera-error">{error}</p>
      ) : (
        <div className="camera-wrapper">
          <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
          <canvas ref={overlayRef} className="camera-overlay" />
          <canvas ref={captureRef} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
}
