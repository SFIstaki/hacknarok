import React, { useEffect, useMemo } from 'react';
import type { Behavior } from '../hooks/useFocusTracking';
import type { Theme } from '../App';
import { pickMascot } from '../assets/mascots';

interface FocusAlertProps {
  alertActive: boolean;
  alertBehavior: Behavior | null;
  onDismiss: () => void;
  theme: Theme;
}

const BEHAVIOR_CONTENT: Record<Behavior, { title: string; body: string; accent: string }> = {
  faceAbsent: {
    title: 'Where did you go?',
    body: "We can't see your face. Still at your desk?",
    accent: '#e53e3e',
  },
  eyesClosed: {
    title: 'Feeling drowsy?',
    body: 'Your eyes have been closed a while. Maybe take a break.',
    accent: '#805ad5',
  },
  yawning: {
    title: 'Big yawn detected!',
    body: 'Feeling tired? Grab some water or stretch for a minute.',
    accent: '#d69e2e',
  },
  lookingAway: {
    title: 'Eyes drifting...',
    body: "Your gaze wandered from the screen. Let's bring it back.",
    accent: '#ed8936',
  },
  headTurned: {
    title: 'Head turned away',
    body: 'You seem to be looking elsewhere. Ready to refocus?',
    accent: '#3182ce',
  },
};

const AUTO_DISMISS_MS = 12_000;

export default function FocusAlert({
  alertActive,
  alertBehavior,
  onDismiss,
  theme,
}: FocusAlertProps): React.JSX.Element | null {
  useEffect(() => {
    if (!alertActive) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [alertActive, alertBehavior, onDismiss]);

  const mascotSvg = useMemo(
    () => (alertBehavior ? pickMascot(alertBehavior) : null),
    [alertBehavior]
  );

  if (!alertActive || !alertBehavior) return null;

  const { title, body, accent } = BEHAVIOR_CONTENT[alertBehavior];

  return (
    <div className={`focus-toast${theme === 'dark' ? ' dark' : ''}`} role="alert">
      <div className="focus-toast-accent" style={{ background: accent }} />
      {mascotSvg && (
        <div className="focus-toast-mascot" dangerouslySetInnerHTML={{ __html: mascotSvg }} />
      )}
      <div className="focus-toast-content">
        <p className="focus-toast-title">{title}</p>
        <p className="focus-toast-body">{body}</p>
      </div>
      <button className="focus-toast-dismiss" onClick={onDismiss} title="Dismiss">
        ✕
      </button>
    </div>
  );
}
