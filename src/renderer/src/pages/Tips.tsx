import React, { useState, useEffect, useCallback } from 'react';
import type { T, Exercise } from '../i18n';
import '../assets/tips.css';

interface TipsProps {
  t: T;
}

const RING_R = 30;
const RING_C = +(2 * Math.PI * RING_R).toFixed(2);

function ExerciseCard({ exercise, t }: { exercise: Exercise; t: T }): React.JSX.Element {
  const [timeLeft, setTimeLeft] = useState(exercise.duration);
  const [running, setRunning] = useState(false);
  const done = timeLeft === 0;

  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running, done]);

  const reset = useCallback(() => {
    setRunning(false);
    setTimeLeft(exercise.duration);
  }, [exercise.duration]);

  const toggle = () => {
    if (done) {
      reset();
      return;
    }
    setRunning((r) => !r);
  };

  const progress = timeLeft / exercise.duration;
  const offset = RING_C * (1 - progress);
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : String(secs);
  const started = timeLeft < exercise.duration;

  return (
    <div
      className={`exercise-card${running ? ' exercise-card--running' : done ? ' exercise-card--done' : ''}`}
    >
      <div className="exercise-header">
        <span className="exercise-icon">{exercise.icon}</span>
        <div className="exercise-text">
          <h3 className="exercise-title">{exercise.title}</h3>
          <p className="exercise-desc">{exercise.description}</p>
        </div>
      </div>

      <div className="exercise-footer">
        <div className="exercise-ring-wrap">
          <svg className="exercise-ring" width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={RING_R} className="ring-track" />
            <circle
              cx="36"
              cy="36"
              r={RING_R}
              className="ring-progress"
              style={{
                strokeDasharray: RING_C,
                strokeDashoffset: done ? RING_C : offset,
                transform: 'rotate(-90deg)',
                transformOrigin: '36px 36px',
                transition: running ? 'stroke-dashoffset 1s linear' : 'none',
              }}
            />
          </svg>
          <span className="ring-label">{done ? '✓' : timeStr}</span>
        </div>

        <div className="exercise-controls">
          <button className="exercise-btn exercise-btn--primary" onClick={toggle}>
            {done ? t.exerciseReset : running ? t.exercisePause : t.exerciseStart}
          </button>
          {started && !done && (
            <button className="exercise-btn exercise-btn--secondary" onClick={reset}>
              {t.exerciseReset}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Tips({ t }: TipsProps): React.JSX.Element {
  return (
    <div className="tips-page">
      <div className="tips-header">
        <h2 className="tips-title">{t.mindfulnessTitle}</h2>
        <p className="tips-subtitle">{t.mindfulnessSubtitle}</p>
      </div>
      <div className="tips-grid">
        {t.exercises.map((ex) => (
          <ExerciseCard key={ex.id} exercise={ex} t={t} />
        ))}
      </div>
    </div>
  );
}
