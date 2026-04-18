import { useState, useEffect } from 'react';
import type { T, FocusState } from '../i18n';
import type { Page } from '../types';

const TIP_INTERVAL_MS = 20_000;
const CURRENT_STATE: FocusState = 'locked';
const FOCUS_MINUTES = 252;

const STATE_COLORS = {
  light: {
    locked: { bg: '#d4f0e0', text: '#1a6640', glow: 'rgba(72,187,120,0.25)' },
    fading: { bg: '#fde8c8', text: '#8a4d0f', glow: 'rgba(237,137,54,0.25)' },
    gone: { bg: '#fdd8d8', text: '#8a1f1f', glow: 'rgba(220,80,80,0.25)' },
  },
  dark: {
    locked: { bg: 'rgba(72,187,120,0.18)', text: '#6ee7a0', glow: 'rgba(72,187,120,0.2)' },
    fading: { bg: 'rgba(237,137,54,0.18)', text: '#fbbf6a', glow: 'rgba(237,137,54,0.2)' },
    gone: { bg: 'rgba(220,80,80,0.18)', text: '#fca5a5', glow: 'rgba(220,80,80,0.2)' },
  },
} satisfies Record<string, Record<FocusState, { bg: string; text: string; glow: string }>>;

const TIMELINE: { state: FocusState | 'break'; pct: number }[] = [
  { state: 'locked', pct: 30 },
  { state: 'break', pct: 5 },
  { state: 'fading', pct: 12 },
  { state: 'gone', pct: 7 },
  { state: 'locked', pct: 18 },
  { state: 'break', pct: 4 },
  { state: 'locked', pct: 14 },
  { state: 'fading', pct: 10 },
];

const TIMELINE_COLORS: Record<string, string> = {
  locked: '#9CD7F0',
  fading: '#F5C28A',
  gone: '#F09090',
  break: '#C8EAFA',
};

const focusData = [
  { day: 'Mon', value: 62 },
  { day: 'Tue', value: 78 },
  { day: 'Wed', value: 55 },
  { day: 'Thu', value: 85 },
  { day: 'Fri', value: 70, current: true },
  { day: 'Sat', value: 60 },
  { day: 'Sun', value: 74 },
];
const BAR_MAX = 100;
const CHART_H = 130;
const BAR_W = 28;
const GAP = 10;

function FocusChart(): React.JSX.Element {
  const totalW = focusData.length * (BAR_W + GAP) - GAP;
  return (
    <svg width={totalW} height={CHART_H + 28} className="focus-chart-svg">
      {focusData.map((d, i) => {
        const barH = (d.value / BAR_MAX) * CHART_H;
        const x = i * (BAR_W + GAP);
        const y = CHART_H - barH;
        return (
          <g key={d.day}>
            {d.current ? (
              <rect
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                rx={8}
                fill="rgba(93,186,224,0.18)"
                stroke="#5DBAE0"
                strokeWidth={2}
              />
            ) : (
              <rect x={x} y={y} width={BAR_W} height={barH} rx={8} fill="#9CD7F0" />
            )}
            <text
              x={x + BAR_W / 2}
              y={CHART_H + 20}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              opacity={0.45}
              fontFamily="Nunito, sans-serif"
              fontWeight="600"
            >
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BeaverMascot(): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 130" className="beaver-svg" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="122" rx="32" ry="10" fill="#8B5E3C" />
      <ellipse cx="60" cy="120" rx="28" ry="8" fill="#a0714f" />
      <ellipse cx="60" cy="95" rx="30" ry="26" fill="#c49a72" />
      <ellipse cx="60" cy="98" rx="18" ry="17" fill="#e8c99a" />
      <ellipse cx="60" cy="60" rx="28" ry="26" fill="#c49a72" />
      <ellipse cx="36" cy="38" rx="9" ry="10" fill="#c49a72" />
      <ellipse cx="84" cy="38" rx="9" ry="10" fill="#c49a72" />
      <ellipse cx="36" cy="38" rx="5" ry="6" fill="#e8a090" />
      <ellipse cx="84" cy="38" rx="5" ry="6" fill="#e8a090" />
      <circle cx="50" cy="58" r="6" fill="white" />
      <circle cx="70" cy="58" r="6" fill="white" />
      <circle cx="51" cy="59" r="3.5" fill="#2d1a0e" />
      <circle cx="71" cy="59" r="3.5" fill="#2d1a0e" />
      <circle cx="52" cy="57.5" r="1.2" fill="white" />
      <circle cx="72" cy="57.5" r="1.2" fill="white" />
      <ellipse cx="60" cy="68" rx="5" ry="3.5" fill="#8B3a2a" />
      <path
        d="M55 72 Q60 76 65 72"
        stroke="#8B3a2a"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="56" y="71" width="7" height="6" rx="1.5" fill="white" />
      <line x1="59.5" y1="71" x2="59.5" y2="77" stroke="#e0d0c0" strokeWidth="1" />
      <ellipse cx="33" cy="98" rx="8" ry="12" fill="#c49a72" transform="rotate(-15 33 98)" />
      <ellipse cx="87" cy="98" rx="8" ry="12" fill="#c49a72" transform="rotate(15 87 98)" />
    </svg>
  );
}

import type { Theme } from '../App';

interface HomeProps {
  t: T;
  onNavigate: (page: Page) => void;
  theme: Theme;
}

export default function Home({ t, onNavigate, theme }: HomeProps): React.JSX.Element {
  const [tipVisible, setTipVisible] = useState(true);

  useEffect(() => {
    if (tipVisible) return;
    const id = setTimeout(() => setTipVisible(true), TIP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [tipVisible]);

  const stateColor = STATE_COLORS[theme][CURRENT_STATE];

  return (
    <div className="home-page">
      <div className="home-row">
        <div className="focus-state-card">
          <p className="focus-state-label">{t.focusStateLabel}</p>
          <p className="focus-state-name" style={{ color: stateColor.text }}>
            {t.focusStateNames[CURRENT_STATE]}
          </p>
          <div className="focus-state-pills">
            {(['locked', 'fading', 'gone'] as FocusState[]).map((s) => (
              <span
                key={s}
                className={`focus-pill ${s === CURRENT_STATE ? 'focus-pill--active' : ''}`}
                style={
                  s === CURRENT_STATE
                    ? {
                        background: stateColor.bg,
                        color: stateColor.text,
                        boxShadow: `0 0 0 4px ${stateColor.glow}`,
                      }
                    : {}
                }
              >
                {t.focusStateNames[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="home-main-card">
          <div className="chart-area">
            <FocusChart />
          </div>
          <div className="stats-callout">
            <p className="stats-main">
              {t.statMain1} <span className="stats-badge">20%</span> {t.statMain2}
            </p>
            <p className="stats-sub">{t.statSub}</p>
            <button className="stats-btn" onClick={() => onNavigate('stats')}>
              {t.statBtn}
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-card">
        <p className="timeline-label">{t.timelineLabel(FOCUS_MINUTES)}</p>
        <div className="timeline-bar">
          {TIMELINE.map((seg, i) => (
            <div
              key={i}
              className="timeline-seg"
              style={{ flex: seg.pct, background: TIMELINE_COLORS[seg.state] }}
            />
          ))}
        </div>
      </div>

      <div className="mascot-widget">
        <div className={`mascot-bubble ${tipVisible ? 'mascot-bubble--visible' : ''}`}>
          <p>
            {t.tipSome} <span className="tips-highlight">{t.tipWord}</span> {t.tipText}
          </p>
          <div className="bubble-tail" />
        </div>
        <button className="mascot-btn" onClick={() => setTipVisible(false)} title="Dismiss SFIstak">
          <BeaverMascot />
        </button>
      </div>
    </div>
  );
}
