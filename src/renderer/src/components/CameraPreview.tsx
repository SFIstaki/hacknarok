import React from 'react';
import type { FocusState } from '../i18n';
import type { Theme } from '../App';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  focusState: FocusState;
  isTracking: boolean;
  isLoading: boolean;
  theme: Theme;
}

const STATE_BORDER: Record<FocusState, string> = {
  locked: '#48bb78',
  fading: '#ed8936',
  gone: '#e53e3e',
};

const STATE_LABEL: Record<FocusState, string> = {
  locked: 'Focused',
  fading: 'Drifting',
  gone: 'Away',
};

export default function CameraPreview({
  videoRef,
  focusState,
  isTracking,
  isLoading,
  theme,
}: CameraPreviewProps): React.JSX.Element {
  const borderColor = isTracking ? STATE_BORDER[focusState] : '#555';

  return (
    <div className={`camera-preview-widget${theme === 'dark' ? ' dark' : ''}`}>
      <div className="camera-video-wrap" style={{ borderColor }}>
        {/* Always mounted so videoRef is set before startTracking assigns srcObject */}
        <video ref={videoRef} className="camera-video" autoPlay muted playsInline />

        {isLoading && (
          <div className="camera-loading-overlay">
            <span className="camera-loading-dot" />
            <span>Loading model…</span>
          </div>
        )}

        {isTracking && (
          <div className="camera-state-badge" style={{ background: borderColor }}>
            {STATE_LABEL[focusState]}
          </div>
        )}
      </div>
    </div>
  );
}
