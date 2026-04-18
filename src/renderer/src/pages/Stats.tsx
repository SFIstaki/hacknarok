import type { T } from '../i18n';
import { useEffect, useState } from 'react';

interface StatsProps {
  t: T;
}

type DashboardToday = Awaited<ReturnType<typeof window.api.getTodayReport>>;
type GeneratedReport = Awaited<ReturnType<typeof window.api.generateReport>>;

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

export default function Stats({ t: _t }: StatsProps): React.JSX.Element {
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void window.api
      .getTodayReport()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setToday(data);
      })
      .catch(() => {
        if (isMounted) {
          setError('Could not load dashboard data');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const generateReport = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);

    try {
      const generated = await window.api.generateReport();
      setReport(generated);
      const refreshedToday = await window.api.getTodayReport();
      setToday(refreshedToday);
    } catch {
      setError('Could not generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-content stats-page">
      <div className="stats-header-row">
        <h2 className="stats-title">Dashboard summary & report</h2>
        <button className="stats-generate-btn" onClick={() => void generateReport()} disabled={isGenerating}>
          {isGenerating ? 'Generating…' : 'Generate today report'}
        </button>
      </div>

      {today && (
        <div className="stats-kpi-grid">
          <div className="stats-kpi-card">
            <div className="stats-kpi-label">Current state</div>
            <div className="stats-kpi-value">{today.currentState}</div>
          </div>
          <div className="stats-kpi-card">
            <div className="stats-kpi-label">Locked today</div>
            <div className="stats-kpi-value">{formatDuration(today.stats.lockedMs)}</div>
          </div>
          <div className="stats-kpi-card">
            <div className="stats-kpi-label">Delta vs yesterday</div>
            <div className="stats-kpi-value">{formatPercent(today.delta.percentChange)}</div>
          </div>
          <div className="stats-kpi-card">
            <div className="stats-kpi-label">Latest snapshot</div>
            <div className="stats-kpi-value stats-kpi-small">
              {today.reportStatus.latestSnapshotGeneratedAtTs
                ? new Date(today.reportStatus.latestSnapshotGeneratedAtTs).toLocaleString()
                : 'Not generated yet'}
            </div>
          </div>
        </div>
      )}

      {today && (
        <div className="stats-section-card">
          <h3 className="stats-section-title">Attention timeline (today)</h3>
          <div className="timeline-bar">
            {today.timeline.length > 0 ? (
              today.timeline.map((point) => (
                <div
                  key={point.bucketStart}
                  className="timeline-seg"
                  style={{
                    flex: 1,
                    background:
                      point.state === 'locked'
                        ? '#8cdcb4'
                        : point.state === 'fading'
                          ? '#F5C28A'
                          : '#F09090',
                  }}
                  title={`${new Date(point.bucketStart).toLocaleTimeString()} — ${point.state}`}
                />
              ))
            ) : (
              <div className="timeline-empty">No snapshot timeline yet</div>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="stats-section-card">
          <h3 className="stats-section-title">Generated report snapshot</h3>
          <div className="report-grid">
            <div className="report-block">
              <div className="report-block-title">Today</div>
              <div>Locked: {formatDuration(report.stats.lockedMs)}</div>
              <div>Fading: {formatDuration(report.stats.fadingMs)}</div>
              <div>Gone: {formatDuration(report.stats.goneMs)}</div>
            </div>
            <div className="report-block">
              <div className="report-block-title">Yesterday</div>
              <div>Locked: {formatDuration(report.yesterdayStats.lockedMs)}</div>
              <div>Fading: {formatDuration(report.yesterdayStats.fadingMs)}</div>
              <div>Gone: {formatDuration(report.yesterdayStats.goneMs)}</div>
            </div>
            <div className="report-block">
              <div className="report-block-title">Delta</div>
              <div>{formatPercent(report.delta.percentChange)}</div>
              <div className="report-meta">Generated: {new Date(report.generatedAtTs).toLocaleString()}</div>
            </div>
          </div>

          <div className="report-top-apps">
            <div className="report-block-title">Top apps (locked)</div>
            {report.topApps.length > 0 ? (
              <ul>
                {report.topApps.map((app) => (
                  <li key={app.appName}>
                    <span>{app.appName}</span>
                    <strong>{formatDuration(app.durationMs)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No apps yet</p>
            )}
          </div>
        </div>
      )}

      {error && <div className="home-status-line">{error}</div>}
    </div>
  );
}
