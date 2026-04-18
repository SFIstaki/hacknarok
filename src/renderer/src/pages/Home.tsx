import { useState, useEffect } from 'react';
import type { T, FocusState } from '../i18n';
import type { Page } from '../types';

const TIP_INTERVAL_MS = 20_000;

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

const TIMELINE_COLORS: Record<string, string> = {
  locked: '#8cdcb4',
  fading: '#F5C28A',
  gone: '#F09090',
};

type DashboardToday = Awaited<ReturnType<typeof window.api.getTodayReport>>;

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function defaultTodayReport(): DashboardToday {
  return {
    nowTs: Date.now(),
    currentState: 'gone',
    currentAppName: null,
    currentWindowTitle: null,
    reportStatus: {
      hasTodaySnapshot: false,
      latestSnapshotGeneratedAtTs: null,
      latestSnapshotDayStartTs: null,
      latestSnapshotDayEndTs: null,
    },
    timeline: [],
    stats: {
      lockedMs: 0,
      fadingMs: 0,
      goneMs: 0,
      totalMs: 0,
    },
    delta: {
      todayLockedMs: 0,
      yesterdayLockedMs: 0,
      percentChange: null,
    },
    topApps: [],
  };
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
  const [report, setReport] = useState<DashboardToday>(defaultTodayReport());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tipVisible) return;
    const id = setTimeout(() => setTipVisible(true), TIP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [tipVisible]);

  useEffect(() => {
    let isMounted = true;

    void window.api
      .getTodayReport()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setReport(data);
        setError(null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setError('Could not load dashboard summary');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = window.api.onDashboardUpdate((payload) => {
      setReport(payload);
      setError(null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const stateColor = STATE_COLORS[theme][report.currentState];
  const focusMinutes = Math.round(report.stats.lockedMs / 60_000);
  const hasSnapshot = report.reportStatus.hasTodaySnapshot;
  const summaryItems = [
    { label: 'Locked', value: formatDuration(report.stats.lockedMs) },
    { label: 'Fading', value: formatDuration(report.stats.fadingMs) },
    { label: 'Gone', value: formatDuration(report.stats.goneMs) },
    { label: 'Delta', value: formatPercent(report.delta.percentChange) },
  ];

  return (
    <div className="home-page">
      <div className="home-row">
        <div className="focus-state-card">
          <p className="focus-state-label">{t.focusStateLabel}</p>
          <p className="focus-state-name" style={{ color: stateColor.text }}>
            {t.focusStateNames[report.currentState]}
          </p>
          <p className="focus-state-subline">{report.currentAppName ?? 'No active app detected'}</p>
          <div className="focus-state-pills">
            {(['locked', 'fading', 'gone'] as FocusState[]).map((s) => (
              <span
                key={s}
                className={`focus-pill ${s === report.currentState ? 'focus-pill--active' : ''}`}
                style={
                  s === report.currentState
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
            <div className="summary-grid">
              {summaryItems.map((item) => (
                <div key={item.label} className="summary-item">
                  <div className="summary-item-label">{item.label}</div>
                  <div className="summary-item-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="stats-callout">
            <p className="stats-main">
              {t.statMain1} <span className="stats-badge">{formatPercent(report.delta.percentChange)}</span>{' '}
              {t.statMain2}
            </p>
            <p className="stats-sub">
              {hasSnapshot ? t.statSub : 'No daily snapshot yet. Generate a report in Stats.'}
            </p>
            <button className="stats-btn" onClick={() => onNavigate('stats')}>
              {t.statBtn}
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-card">
        <p className="timeline-label">{t.timelineLabel(focusMinutes)}</p>
        <div className="timeline-bar">
          {report.timeline.length > 0 ? (
            report.timeline.map((point) => (
              <div
                key={point.bucketStart}
                className="timeline-seg"
                style={{ flex: 1, background: TIMELINE_COLORS[point.state] }}
                title={`${new Date(point.bucketStart).toLocaleTimeString()} — ${t.focusStateNames[point.state]}`}
              />
            ))
          ) : (
            <div className="timeline-empty">No timeline data yet</div>
          )}
        </div>
        {report.topApps.length > 0 && (
          <div className="top-apps-inline">
            {report.topApps.map((app) => (
              <span key={app.appName} className="top-app-pill">
                {app.appName}: {formatDuration(app.durationMs)}
              </span>
            ))}
          </div>
        )}
      </div>

      {(isLoading || error) && (
        <div className="home-status-line">
          {isLoading ? 'Loading summary…' : error}
        </div>
      )}

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
