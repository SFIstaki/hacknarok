import { useEffect, useRef, useState } from 'react';

export default function Camera(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => setError(err.message));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="page-content camera-page">
      {error ? (
        <p className="camera-error">{error}</p>
      ) : (
        <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
      )}
    </div>
  );
}
