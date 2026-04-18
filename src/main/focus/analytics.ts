import type {
  DeltaLocked,
  FocusDurations,
  FocusEvent,
  FocusState,
  ReportsGenerateResponse,
  TimelinePoint,
  TopAppItem,
} from './types';
import { FIVE_MINUTES_MS } from './time';

interface DerivedSegment {
  startTs: number;
  endTs: number;
  state: FocusState;
  appName: string | null;
}

interface DayMetrics {
  timeline: TimelinePoint[];
  stats: FocusDurations;
  topApps: TopAppItem[];
}

function emptyDurations(): FocusDurations {
  return {
    lockedMs: 0,
    fadingMs: 0,
    goneMs: 0,
    totalMs: 0,
  };
}

function buildDelta(todayLockedMs: number, yesterdayLockedMs: number): DeltaLocked {
  let percentChange: number | null = null;

  if (yesterdayLockedMs > 0) {
    percentChange = ((todayLockedMs - yesterdayLockedMs) / yesterdayLockedMs) * 100;
  } else if (todayLockedMs > 0) {
    percentChange = 100;
  }

  return {
    todayLockedMs,
    yesterdayLockedMs,
    percentChange,
  };
}

function eventsToSegments(
  events: FocusEvent[],
  rangeStart: number,
  rangeEnd: number
): DerivedSegment[] {
  if (rangeEnd <= rangeStart) {
    return [];
  }

  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  let currentState: FocusState = 'gone';
  let currentAppName: string | null = null;
  let pointer = rangeStart;

  const lastBeforeRange = [...sorted].reverse().find((event) => event.ts < rangeStart);
  if (lastBeforeRange) {
    currentState = lastBeforeRange.state;
    currentAppName = lastBeforeRange.appName;
  }

  const inRange = sorted.filter((event) => event.ts >= rangeStart && event.ts < rangeEnd);
  const segments: DerivedSegment[] = [];

  for (const event of inRange) {
    if (event.ts > pointer) {
      segments.push({
        startTs: pointer,
        endTs: event.ts,
        state: currentState,
        appName: currentAppName,
      });
    }

    currentState = event.state;
    currentAppName = event.appName;
    pointer = event.ts;
  }

  if (pointer < rangeEnd) {
    segments.push({
      startTs: pointer,
      endTs: rangeEnd,
      state: currentState,
      appName: currentAppName,
    });
  }

  return segments;
}

function deriveMetrics(events: FocusEvent[], rangeStart: number, rangeEnd: number): DayMetrics {
  const segments = eventsToSegments(events, rangeStart, rangeEnd);
  const stats = emptyDurations();
  const appDurations = new Map<string, number>();

  for (const segment of segments) {
    const duration = Math.max(0, segment.endTs - segment.startTs);

    if (segment.state === 'locked') {
      stats.lockedMs += duration;
      const appName = segment.appName || 'Unknown';
      appDurations.set(appName, (appDurations.get(appName) ?? 0) + duration);
    } else if (segment.state === 'fading') {
      stats.fadingMs += duration;
    } else {
      stats.goneMs += duration;
    }
  }

  stats.totalMs = stats.lockedMs + stats.fadingMs + stats.goneMs;

  const timeline: TimelinePoint[] = [];
  let segmentIdx = 0;

  for (let bucketStart = rangeStart; bucketStart < rangeEnd; bucketStart += FIVE_MINUTES_MS) {
    while (segmentIdx < segments.length && segments[segmentIdx].endTs <= bucketStart) {
      segmentIdx += 1;
    }

    const state =
      segmentIdx < segments.length && segments[segmentIdx].startTs <= bucketStart
        ? segments[segmentIdx].state
        : 'gone';

    timeline.push({ bucketStart, state });
  }

  const topApps = [...appDurations.entries()]
    .map(([appName, durationMs]) => ({ appName, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 3);

  return {
    timeline,
    stats,
    topApps,
  };
}

export function buildDayReportFromEvents(
  eventsForDay: FocusEvent[],
  eventsForYesterday: FocusEvent[],
  dayStartTs: number,
  dayEndTs: number
): ReportsGenerateResponse {
  const yesterdayStartTs = dayStartTs - 24 * 60 * 60 * 1000;

  const today = deriveMetrics(eventsForDay, dayStartTs, dayEndTs);
  const yesterday = deriveMetrics(eventsForYesterday, yesterdayStartTs, dayStartTs);

  return {
    generatedAtTs: Date.now(),
    dayStartTs,
    dayEndTs,
    timeline: today.timeline,
    stats: today.stats,
    yesterdayStats: yesterday.stats,
    delta: buildDelta(today.stats.lockedMs, yesterday.stats.lockedMs),
    topApps: today.topApps,
  };
}
