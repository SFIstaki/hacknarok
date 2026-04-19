import type { T } from '../i18n';
import { useEffect, useMemo, useState } from 'react';

interface StatsProps {
  t: T;
}

type DashboardToday = Awaited<ReturnType<typeof window.api.getTodayReport>>;
type GeneratedReport = Awaited<ReturnType<typeof window.api.generateReport>>;
type AttentionState = DashboardToday['timeline'][number]['state'];

const STATE_SCORE: Record<AttentionState, number> = {
  locked: 1,
  fading: 0.55,
  gone: 0.15,
};

const STATE_COLORS: Record<AttentionState, string> = {
  locked: '#8cdcb4',
  fading: '#F5C28A',
  gone: '#F09090',
};

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

function toPercent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (part / total) * 100;
}

interface HourlyPoint {
  hour: number;
  score: number;
  dominantState: AttentionState;
}

const ZOOM_OPTIONS_HOURS = [3, 6, 12, 24] as const;
const INITIAL_STATE_LOADING_MS = 3_000;
const INITIAL_STATE_LOADING_SESSION_KEY = 'presently.initialStateLoadingShown';

function scoreToPercent(score: number): number {
  return Math.round(score * 100);
}

function getStateLabel(state: AttentionState): string {
  if (state === 'locked') {
    return 'Locked';
  }

  if (state === 'fading') {
    return 'Drifting';
  }

  return 'Gone';
}

export default function Stats({ t: _t }: StatsProps): React.JSX.Element {
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStateLoading, setShowStateLoading] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(INITIAL_STATE_LOADING_SESSION_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [zoomHours, setZoomHours] = useState<(typeof ZOOM_OPTIONS_HOURS)[number]>(12);
  const [pan24hPct, setPan24hPct] = useState(0);

  useEffect(() => {
    if (!showStateLoading) {
      return;
    }

    const id = setTimeout(() => {
      setShowStateLoading(false);
      try {
        window.sessionStorage.setItem(INITIAL_STATE_LOADING_SESSION_KEY, '1');
      } catch {
        // ignore
      }
    }, INITIAL_STATE_LOADING_MS);

    return () => clearTimeout(id);
  }, [showStateLoading]);

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

  const hourlySeries = useMemo<HourlyPoint[]>(() => {
    if (!today) {
      return [];
    }

    const statsByHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      totalScore: 0,
      count: 0,
      lockedCount: 0,
      fadingCount: 0,
      goneCount: 0,
    }));

    for (const point of today.timeline) {
      const hour = new Date(point.bucketStart).getHours();
      const bucket = statsByHour[hour];
      bucket.totalScore += STATE_SCORE[point.state];
      bucket.count += 1;

      if (point.state === 'locked') {
        bucket.lockedCount += 1;
      } else if (point.state === 'fading') {
        bucket.fadingCount += 1;
      } else {
        bucket.goneCount += 1;
      }
    }

    return statsByHour.map((bucket) => {
      const score = bucket.count > 0 ? bucket.totalScore / bucket.count : 0;

      let dominantState: AttentionState = 'gone';
      if (bucket.lockedCount >= bucket.fadingCount && bucket.lockedCount >= bucket.goneCount) {
        dominantState = 'locked';
      } else if (bucket.fadingCount >= bucket.goneCount) {
        dominantState = 'fading';
      }

      return {
        hour: bucket.hour,
        score,
        dominantState,
      };
    });
  }, [today]);

  const attentionInsights = useMemo(() => {
    if (hourlySeries.length === 0) {
      return {
        peakHour: null as number | null,
        driftHour: null as number | null,
      };
    }

    const peak = hourlySeries.reduce(
      (acc, point) => (point.score > acc.score ? point : acc),
      hourlySeries[0]
    );

    let driftHour: number | null = null;
    for (let i = 1; i < hourlySeries.length; i += 1) {
      const prev = hourlySeries[i - 1];
      const current = hourlySeries[i];

      if (prev.score >= 0.7 && current.score < 0.6) {
        driftHour = current.hour;
        break;
      }
    }

    return {
      peakHour: peak.hour,
      driftHour,
    };
  }, [hourlySeries]);

  const [hoveredBucketStart, setHoveredBucketStart] = useState<number | null>(null);

  const denseSeries = useMemo(() => {
    if (!today) {
      return [] as Array<{ bucketStart: number; score: number; state: AttentionState }>;
    }

    return today.timeline
      .filter((_, idx) => idx % 2 === 0)
      .map((point) => ({
        bucketStart: point.bucketStart,
        score: STATE_SCORE[point.state],
        state: point.state,
      }));
  }, [today]);

  const hoveredDensePoint =
    hoveredBucketStart === null
      ? null
      : (denseSeries.find((item) => item.bucketStart === hoveredBucketStart) ?? null);

  const visibleSeries = useMemo(() => {
    if (denseSeries.length === 0) {
      return denseSeries;
    }

    if (zoomHours >= 24) {
      return denseSeries;
    }

    const rangeEnd = denseSeries[denseSeries.length - 1].bucketStart;
    const rangeStart = rangeEnd - zoomHours * 60 * 60 * 1000;
    const sliced = denseSeries.filter((point) => point.bucketStart >= rangeStart);

    return sliced.length > 0 ? sliced : denseSeries;
  }, [denseSeries, zoomHours]);

  const pannedSeries = useMemo(() => {
    if (zoomHours !== 24 || visibleSeries.length === 0) {
      return visibleSeries;
    }

    const startTs = visibleSeries[0].bucketStart;
    const endTs = visibleSeries[visibleSeries.length - 1].bucketStart;
    const windowMs = 8 * 60 * 60 * 1000;
    const totalMs = endTs - startTs;

    if (totalMs <= windowMs) {
      return visibleSeries;
    }

    const maxStartTs = endTs - windowMs;
    const currentStartTs = startTs + (pan24hPct / 100) * (maxStartTs - startTs);
    const currentEndTs = currentStartTs + windowMs;

    const sliced = visibleSeries.filter(
      (point) => point.bucketStart >= currentStartTs && point.bucketStart <= currentEndTs
    );

    return sliced.length > 0 ? sliced : visibleSeries;
  }, [pan24hPct, visibleSeries, zoomHours]);

  const visibleSeriesDownsampled = useMemo(() => {
    if (pannedSeries.length <= 90) {
      return pannedSeries;
    }

    const step = Math.ceil(pannedSeries.length / 90);
    return pannedSeries.filter((_, idx) => idx % step === 0);
  }, [pannedSeries]);

  const chartGeometry = {
    width: 820,
    height: 280,
    padX: 38,
    padY: 28,
  };

  const innerWidth = chartGeometry.width - chartGeometry.padX * 2;
  const innerHeight = chartGeometry.height - chartGeometry.padY * 2;

  const denseRangeStart = visibleSeriesDownsampled[0]?.bucketStart ?? Date.now();
  const denseRangeEnd =
    visibleSeriesDownsampled[visibleSeriesDownsampled.length - 1]?.bucketStart ??
    denseRangeStart + 1;
  const denseRange = Math.max(1, denseRangeEnd - denseRangeStart);

  const chartPoints = visibleSeriesDownsampled.map((point) => {
    const x =
      chartGeometry.padX + ((point.bucketStart - denseRangeStart) / denseRange) * innerWidth;
    const y = chartGeometry.padY + (1 - point.score) * innerHeight;
    return { ...point, x, y };
  });

  const hourTicks = useMemo(() => {
    if (visibleSeriesDownsampled.length === 0) {
      return [] as number[];
    }

    const startTs = visibleSeriesDownsampled[0].bucketStart;
    const endTs = visibleSeriesDownsampled[visibleSeriesDownsampled.length - 1].bucketStart;
    const hourMs = 60 * 60 * 1000;

    let tickTs = Math.floor(startTs / hourMs) * hourMs;
    if (tickTs < startTs) {
      tickTs += hourMs;
    }

    const ticks: number[] = [];
    while (tickTs <= endTs) {
      ticks.push(tickTs);
      tickTs += hourMs;
    }

    return ticks;
  }, [visibleSeriesDownsampled]);

  const hourLabelStep = hourTicks.length > 12 ? 2 : 1;

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');

  useEffect(() => {
    if (zoomHours !== 24) {
      setPan24hPct(0);
    }
  }, [zoomHours]);

  const focusShare = useMemo(() => {
    if (!today) {
      return {
        lockedPct: 0,
        driftingPct: 0,
        gonePct: 0,
      };
    }

    const lockedPct = toPercent(today.stats.lockedMs, today.stats.totalMs);
    const driftingPct = toPercent(today.stats.fadingMs, today.stats.totalMs);
    const gonePct = Math.max(0, 100 - lockedPct - driftingPct);

    return {
      lockedPct,
      driftingPct,
      gonePct,
    };
  }, [today]);

  const timelineForBar = useMemo(() => {
    if (!today) {
      return [] as DashboardToday['timeline'];
    }

    const points = today.timeline;
    if (points.length <= 96) {
      return points;
    }

    const step = Math.ceil(points.length / 96);
    return points.filter((_, idx) => idx % step === 0);
  }, [today]);

  return (
    <div className="page-content stats-page">
      <div className="stats-header-row">
        <h2 className="stats-title">{_t.statsTitle || 'Dashboard summary & report'}</h2>
        <button
          className="stats-generate-btn"
          onClick={() => void generateReport()}
          disabled={isGenerating}
        >
          {isGenerating
            ? _t.generating || 'Generating…'
            : _t.generateTodayReport || 'Generate today report'}
        </button>
      </div>

      {today && (
        <div className="stats-kpi-grid">
          <div className="stats-kpi-card">
            <div className="stats-kpi-label">{_t.currentStateLabel || 'Current state'}</div>
            <div className="stats-kpi-value">
              {showStateLoading ? 'Loading...' : _t.focusStateNames[today.currentState]}
            </div>
          </div>

          <div className="stats-section-card chart-card">
            <h3 className="stats-section-title">{_t.focusMixTitle || 'Focus mix (simple)'}</h3>
            <div className="focus-mix-wrap">
              <div
                className="focus-mix-donut"
                style={{
                  background: `conic-gradient(
                    #8cdcb4 0 ${focusShare.lockedPct}%,
                    #F5C28A ${focusShare.lockedPct}% ${focusShare.lockedPct + focusShare.driftingPct}%,
                    #F09090 ${focusShare.lockedPct + focusShare.driftingPct}% 100%
                  )`,
                }}
              >
                <div className="focus-mix-inner">
                  <div className="focus-mix-main">{Math.round(focusShare.lockedPct)}%</div>
                  <div className="focus-mix-sub">{_t.focusStateNames.locked}</div>
                </div>
              </div>

              <div className="focus-mix-legend">
                <div className="legend-row">
                  <span className="legend-dot legend-dot--locked" />
                  <span>{_t.focusStateNames.locked}</span>
                  <strong>{Math.round(focusShare.lockedPct)}%</strong>
                </div>
                <div className="legend-row">
                  <span className="legend-dot legend-dot--fading" />
                  <span>{_t.focusStateNames.fading}</span>
                  <strong>{Math.round(focusShare.driftingPct)}%</strong>
                </div>
                <div className="legend-row">
                  <span className="legend-dot legend-dot--gone" />
                  <span>{_t.focusStateNames.gone}</span>
                  <strong>{Math.round(focusShare.gonePct)}%</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-section-card chart-card">
            <h3 className="stats-section-title">{_t.deltaContextTitle || 'Delta context'}</h3>
            <div className="report-block">
              <div>
                {_t.todayLockedLabel || 'Today locked'}: {formatDuration(today.stats.lockedMs)}
              </div>
              <div>
                {_t.yesterdayLockedLabel || 'Yesterday locked'}:{' '}
                {formatDuration(today.delta.yesterdayLockedMs)}
              </div>
              <div>
                {_t.changeLabel || 'Change'}:{' '}
                <strong>{formatPercent(today.delta.percentChange)}</strong>
              </div>
              <div className="report-meta">
                {_t.compactViewMeta || 'Compact view: only key trend + peak + drift.'}
              </div>
            </div>
          </div>

          <div className="stats-section-card chart-card">
            <h3 className="stats-section-title">{_t.topAppsTitle || 'Top apps (locked time)'}</h3>
            {today.topApps.length > 0 ? (
              <div className="top-apps-chart">
                {today.topApps.map((app) => {
                  const width = toPercent(app.durationMs, Math.max(today.stats.lockedMs, 1));
                  return (
                    <div key={app.appName} className="top-apps-chart-row">
                      <div className="top-apps-chart-head">
                        <span>{app.appName}</span>
                        <strong>{formatDuration(app.durationMs)}</strong>
                      </div>
                      <div className="top-apps-chart-track">
                        <div
                          className="top-apps-chart-fill"
                          style={{ width: `${Math.max(6, width)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="timeline-empty">{_t.noTopApps || 'No top apps yet'}</p>
            )}
          </div>

          <div className="stats-section-card stats-kpi-card--wide">
            <h3 className="stats-section-title">
              {_t.attentionTimelineTitle || 'Attention timeline (today)'}
            </h3>
            <div className="timeline-bar">
              {timelineForBar.length > 0 ? (
                timelineForBar.map((point) => (
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
                <div className="timeline-empty">
                  {_t.noSnapshotTimeline || 'No snapshot timeline yet'}
                </div>
              )}
            </div>
          </div>

          {report && (
            <div className="stats-section-card stats-kpi-card--wide">
              <h3 className="stats-section-title">
                {_t.generatedReportTitle || 'Generated report snapshot'}
              </h3>
              <div className="report-grid">
                <div className="report-block">
                  <div className="report-block-title">{_t.todayLabel || 'Today'}</div>
                  <div>Locked: {formatDuration(report.stats.lockedMs)}</div>
                  <div>Fading: {formatDuration(report.stats.fadingMs)}</div>
                  <div>Gone: {formatDuration(report.stats.goneMs)}</div>
                </div>
                <div className="report-block">
                  <div className="report-block-title">{_t.yesterdayLabel || 'Yesterday'}</div>
                  <div>Locked: {formatDuration(report.yesterdayStats.lockedMs)}</div>
                  <div>Fading: {formatDuration(report.yesterdayStats.fadingMs)}</div>
                  <div>Gone: {formatDuration(report.yesterdayStats.goneMs)}</div>
                </div>
                <div className="report-block">
                  <div className="report-block-title">{_t.deltaLabel || 'Delta'}</div>
                  <div>{formatPercent(report.delta.percentChange)}</div>
                  <div className="report-meta">
                    Generated: {new Date(report.generatedAtTs).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="report-top-apps">
                <div className="report-block-title">
                  {_t.topAppsLockedTitle || 'Top apps (locked)'}
                </div>
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
                  <p>{_t.noAppsYet || 'No apps yet'}</p>
                )}
              </div>
            </div>
          )}

          <div className="stats-kpi-card stats-kpi-card--wide">
            <div className="stats-section-head">
              <h3 className="stats-section-title">
                {_t.attentionSpanByHourTitle || 'Attention span by hour'}
              </h3>
              <div className="chart-zoom-controls" role="group" aria-label="Chart zoom range">
                {ZOOM_OPTIONS_HOURS.map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    className={`chart-zoom-btn ${zoomHours === hours ? 'chart-zoom-btn--active' : ''}`}
                    onClick={() => setZoomHours(hours)}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>
            <div className="attention-line-chart-wrap">
              <div className="attention-chart-scroll">
                <svg
                  viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                  className="attention-line-chart"
                  style={{ width: '100%' }}
                  onMouseLeave={() => setHoveredBucketStart(null)}
                >
                  <line
                    x1={chartGeometry.padX}
                    y1={chartGeometry.padY}
                    x2={chartGeometry.padX}
                    y2={chartGeometry.height - chartGeometry.padY}
                    className="attention-axis"
                  />
                  <line
                    x1={chartGeometry.padX}
                    y1={chartGeometry.height - chartGeometry.padY}
                    x2={chartGeometry.width - chartGeometry.padX}
                    y2={chartGeometry.height - chartGeometry.padY}
                    className="attention-axis"
                  />

                  {[0.25, 0.5, 0.75].map((tick) => {
                    const y = chartGeometry.padY + (1 - tick) * innerHeight;
                    return (
                      <line
                        key={tick}
                        x1={chartGeometry.padX}
                        y1={y}
                        x2={chartGeometry.width - chartGeometry.padX}
                        y2={y}
                        className="attention-grid"
                      />
                    );
                  })}

                  {hourTicks.map((tickTs) => {
                    const x =
                      chartGeometry.padX + ((tickTs - denseRangeStart) / denseRange) * innerWidth;
                    return (
                      <line
                        key={`hour-grid-${tickTs}`}
                        x1={x}
                        y1={chartGeometry.padY}
                        x2={x}
                        y2={chartGeometry.height - chartGeometry.padY}
                        className="attention-grid-vertical"
                      />
                    );
                  })}

                  {polyline && <polyline points={polyline} className="attention-polyline" />}

                  {chartPoints.map((point) => (
                    <g
                      key={point.bucketStart}
                      className={`attention-point-group ${hoveredBucketStart === point.bucketStart ? 'attention-point-group--active' : ''}`}
                      onMouseEnter={() => setHoveredBucketStart(point.bucketStart)}
                    >
                      <circle cx={point.x} cy={point.y} r={10} className="attention-point-hit" />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={2.8}
                        style={{ fill: STATE_COLORS[point.state] }}
                        className="attention-point-glow"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={2.8}
                        style={{ fill: STATE_COLORS[point.state] }}
                        className="attention-point"
                      />
                    </g>
                  ))}

                  {hourTicks.map((tickTs, idx) => {
                    if (idx % hourLabelStep !== 0) {
                      return null;
                    }

                    const x =
                      chartGeometry.padX + ((tickTs - denseRangeStart) / denseRange) * innerWidth;
                    const hour = new Date(tickTs).getHours();
                    return (
                      <text
                        key={`hour-label-${tickTs}`}
                        x={x}
                        y={chartGeometry.height - 8}
                        textAnchor="middle"
                        className="attention-hour-label"
                      >
                        {String(hour).padStart(2, '0')}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {zoomHours === 24 && (
                <div className="attention-scroll-slider-wrap">
                  <input
                    className="attention-scroll-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={pan24hPct}
                    onChange={(event) => setPan24hPct(Number(event.target.value))}
                    aria-label="Pan 24h chart"
                  />
                </div>
              )}

              <div className="attention-insight-row">
                <span>
                  Peak:{' '}
                  <strong>
                    {attentionInsights.peakHour !== null
                      ? `${String(attentionInsights.peakHour).padStart(2, '0')}:00`
                      : 'n/a'}
                  </strong>
                </span>
                <span>
                  Drifting start:{' '}
                  <strong>
                    {attentionInsights.driftHour !== null
                      ? `${String(attentionInsights.driftHour).padStart(2, '0')}:00`
                      : 'not detected'}
                  </strong>
                </span>
                <span>
                  Current hover:{' '}
                  <strong>
                    {hoveredDensePoint
                      ? `${new Date(hoveredDensePoint.bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${scoreToPercent(hoveredDensePoint.score)}% · ${getStateLabel(hoveredDensePoint.state)}`
                      : 'move cursor over chart'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="home-status-line">{error}</div>}
    </div>
  );
}
