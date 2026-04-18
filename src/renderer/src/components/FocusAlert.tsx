import React, { useEffect } from 'react';
import type { Behavior } from '../hooks/useFocusTracking';
import type { Theme } from '../App';

interface FocusAlertProps {
  alertActive: boolean;
  alertBehavior: Behavior | null;
  onDismiss: () => void;
  theme: Theme;
}

const BEHAVIOR_CONTENT: Record<
  Behavior,
  { icon: string; title: string; body: string; accent: string }
> = {
  faceAbsent: {
    icon: '🔍',
    title: 'Where did you go?',
    body: "We can't see your face. Still at your desk?",
    accent: '#e53e3e',
  },
  eyesClosed: {
    icon: '😴',
    title: 'Feeling drowsy?',
    body: 'Your eyes have been closed a while. Maybe take a break.',
    accent: '#805ad5',
  },
  yawning: {
    icon: '🥱',
    title: 'Big yawn detected!',
    body: 'Feeling tired? Grab some water or stretch for a minute.',
    accent: '#d69e2e',
  },
  lookingAway: {
    icon: '👀',
    title: 'Eyes drifting...',
    body: "Your gaze wandered from the screen. Let's bring it back.",
    accent: '#ed8936',
  },
  headTurned: {
    icon: '↩️',
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
  // Auto-dismiss after 12s so it doesn't linger forever
  useEffect(() => {
    if (!alertActive) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [alertActive, alertBehavior, onDismiss]);

  if (!alertActive || !alertBehavior) return null;

  const { icon, title, body, accent } = BEHAVIOR_CONTENT[alertBehavior];

  return (
    <div className={`focus-toast${theme === 'dark' ? ' dark' : ''}`} role="alert">
      <div className="focus-toast-accent" style={{ background: accent }} />
      <div className="focus-toast-icon">{icon}</div>
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
