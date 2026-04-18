import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FocusDatabase } from '../database';
import { endOfLocalDay, startOfLocalDay } from '../time';
import type { FocusEvent, FocusState } from '../types';
import { buildDayReportFromEvents } from '../analytics';

interface SegmentSpec {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  state: FocusState;
  appName: string | null;
  windowTitle: string | null;
}

const DEFAULT_DB_PATH = resolve(process.cwd(), 'tmp/focus-monitor.seed.db');
type SeedScenario = 'baseline' | 'set2' | 'set3' | 'absurd' | 'volatile';

function parseDbPath(): string {
  const dbArg = process.argv.find((arg) => arg.startsWith('--db='));
  return dbArg ? resolve(process.cwd(), dbArg.replace('--db=', '')) : DEFAULT_DB_PATH;
}

function parseScenario(): SeedScenario {
  const scenarioArg = process.argv.find((arg) => arg.startsWith('--scenario='));
  const scenario = scenarioArg?.replace('--scenario=', '');

  if (scenario === 'set2') {
    return 'set2';
  }

  if (scenario === 'absurd') {
    return 'absurd';
  }

  if (scenario === 'volatile') {
    return 'volatile';
  }

  if (scenario === 'set3') {
    return 'set3';
  }

  return 'baseline';
}

function at(dayStartTs: number, hour: number, minute: number): number {
  return dayStartTs + (hour * 60 + minute) * 60_000;
}

function buildBaselineDaySegments(profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (profile === 'yesterday') {
    return [
      {
        startHour: 8,
        startMinute: 30,
        endHour: 10,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - backend',
      },
      {
        startHour: 10,
        startMinute: 0,
        endHour: 10,
        endMinute: 20,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'YouTube',
      },
      {
        startHour: 10,
        startMinute: 20,
        endHour: 12,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - pipeline',
      },
      {
        startHour: 12,
        startMinute: 0,
        endHour: 12,
        endMinute: 30,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 0,
        state: 'locked',
        appName: 'Notion',
        windowTitle: 'Sprint plan',
      },
      {
        startHour: 14,
        startMinute: 0,
        endHour: 14,
        endMinute: 25,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'Docs / Slack / Jira',
      },
      {
        startHour: 14,
        startMinute: 25,
        endHour: 16,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - analytics',
      },
    ];
  }

  return [
    {
      startHour: 8,
      startMinute: 30,
      endHour: 11,
      endMinute: 15,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'presently - focus monitor',
    },
    {
      startHour: 11,
      startMinute: 15,
      endHour: 11,
      endMinute: 40,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'YouTube / Chat',
    },
    {
      startHour: 11,
      startMinute: 40,
      endHour: 13,
      endMinute: 0,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'presently - reports API',
    },
    {
      startHour: 13,
      startMinute: 0,
      endHour: 13,
      endMinute: 40,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 13,
      startMinute: 40,
      endHour: 16,
      endMinute: 0,
      state: 'locked',
      appName: 'Terminal',
      windowTitle: 'npm run build',
    },
  ];
}

function buildSet2DaySegments(profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (profile === 'yesterday') {
    return [
      {
        startHour: 8,
        startMinute: 0,
        endHour: 9,
        endMinute: 40,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - review',
      },
      {
        startHour: 9,
        startMinute: 40,
        endHour: 10,
        endMinute: 30,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'Slack / Docs',
      },
      {
        startHour: 10,
        startMinute: 30,
        endHour: 12,
        endMinute: 30,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - coding',
      },
      {
        startHour: 12,
        startMinute: 30,
        endHour: 13,
        endMinute: 0,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 13,
        startMinute: 0,
        endHour: 15,
        endMinute: 15,
        state: 'locked',
        appName: 'Terminal',
        windowTitle: 'tests + build',
      },
    ];
  }

  return [
    {
      startHour: 8,
      startMinute: 0,
      endHour: 8,
      endMinute: 35,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'presently - quick edits',
    },
    {
      startHour: 8,
      startMinute: 35,
      endHour: 9,
      endMinute: 20,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'YouTube / news',
    },
    {
      startHour: 9,
      startMinute: 20,
      endHour: 10,
      endMinute: 20,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 10,
      startMinute: 20,
      endHour: 11,
      endMinute: 20,
      state: 'locked',
      appName: 'Notion',
      windowTitle: 'Planning',
    },
    {
      startHour: 11,
      startMinute: 20,
      endHour: 12,
      endMinute: 5,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'Context switching',
    },
    {
      startHour: 12,
      startMinute: 5,
      endHour: 14,
      endMinute: 30,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 14,
      startMinute: 30,
      endHour: 16,
      endMinute: 0,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'small fixes',
    },
  ];
}

function buildAbsurdDaySegments(profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (profile === 'yesterday') {
    // Wczoraj = set #3 (dokładnie 2h locked), aby porównanie z absurdalnym dniem było bardzo wyraźne.
    return buildSet3DaySegments('today');
  }

  // Dziś = absurdalny dzień: 20h locked in, potem 4h gone.
  return [
    {
      startHour: 0,
      startMinute: 0,
      endHour: 20,
      endMinute: 0,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'ultra deep work mode',
    },
    {
      startHour: 20,
      startMinute: 0,
      endHour: 24,
      endMinute: 0,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
  ];
}

function buildSet3DaySegments(profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (profile === 'yesterday') {
    return [
      {
        startHour: 9,
        startMinute: 0,
        endHour: 10,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'set3 - yesterday block',
      },
      {
        startHour: 10,
        startMinute: 0,
        endHour: 11,
        endMinute: 30,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 11,
        startMinute: 30,
        endHour: 12,
        endMinute: 15,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'set3 - context switching',
      },
      {
        startHour: 12,
        startMinute: 15,
        endHour: 13,
        endMinute: 0,
        state: 'locked',
        appName: 'Terminal',
        windowTitle: 'set3 - quick task',
      },
    ];
  }

  // Dziś = dokładnie 2h locked (09:00-11:00), reszta dnia gone.
  return [
    {
      startHour: 9,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'set3 - 2h locked',
    },
    {
      startHour: 11,
      startMinute: 0,
      endHour: 24,
      endMinute: 0,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
  ];
}

function buildVolatileDaySegments(profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (profile === 'yesterday') {
    return [
      {
        startHour: 7,
        startMinute: 30,
        endHour: 8,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'volatile - sprint start',
      },
      {
        startHour: 8,
        startMinute: 0,
        endHour: 8,
        endMinute: 25,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 8,
        startMinute: 25,
        endHour: 8,
        endMinute: 50,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'volatile - tab storm',
      },
      {
        startHour: 8,
        startMinute: 50,
        endHour: 9,
        endMinute: 35,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'volatile - coding burst',
      },
      {
        startHour: 9,
        startMinute: 35,
        endHour: 10,
        endMinute: 10,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 10,
        startMinute: 10,
        endHour: 10,
        endMinute: 40,
        state: 'locked',
        appName: 'Terminal',
        windowTitle: 'volatile - tests',
      },
      {
        startHour: 10,
        startMinute: 40,
        endHour: 11,
        endMinute: 5,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'volatile - context switch',
      },
      {
        startHour: 11,
        startMinute: 5,
        endHour: 11,
        endMinute: 55,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'volatile - deep block',
      },
      {
        startHour: 11,
        startMinute: 55,
        endHour: 12,
        endMinute: 25,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 12,
        startMinute: 25,
        endHour: 12,
        endMinute: 50,
        state: 'fading',
        appName: 'Slack',
        windowTitle: 'volatile - message blast',
      },
      {
        startHour: 12,
        startMinute: 50,
        endHour: 13,
        endMinute: 35,
        state: 'locked',
        appName: 'Notion',
        windowTitle: 'volatile - planning spike',
      },
      {
        startHour: 13,
        startMinute: 35,
        endHour: 14,
        endMinute: 5,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 14,
        startMinute: 5,
        endHour: 14,
        endMinute: 45,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'volatile - patch wave',
      },
      {
        startHour: 14,
        startMinute: 45,
        endHour: 15,
        endMinute: 5,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'volatile - review loop',
      },
      {
        startHour: 15,
        startMinute: 5,
        endHour: 15,
        endMinute: 45,
        state: 'locked',
        appName: 'Terminal',
        windowTitle: 'volatile - build cycle',
      },
      {
        startHour: 15,
        startMinute: 45,
        endHour: 16,
        endMinute: 30,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
      {
        startHour: 16,
        startMinute: 30,
        endHour: 17,
        endMinute: 10,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'volatile - comeback burst',
      },
      {
        startHour: 17,
        startMinute: 10,
        endHour: 18,
        endMinute: 0,
        state: 'gone',
        appName: null,
        windowTitle: null,
      },
    ];
  }

  return [
    {
      startHour: 7,
      startMinute: 0,
      endHour: 7,
      endMinute: 20,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 7,
      startMinute: 20,
      endHour: 8,
      endMinute: 0,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'volatile - warmup',
    },
    {
      startHour: 8,
      startMinute: 0,
      endHour: 8,
      endMinute: 20,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'volatile - social drift',
    },
    {
      startHour: 8,
      startMinute: 20,
      endHour: 9,
      endMinute: 5,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'volatile - coding burst',
    },
    {
      startHour: 9,
      startMinute: 5,
      endHour: 9,
      endMinute: 30,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 9,
      startMinute: 30,
      endHour: 10,
      endMinute: 5,
      state: 'locked',
      appName: 'Terminal',
      windowTitle: 'volatile - cli sprint',
    },
    {
      startHour: 10,
      startMinute: 5,
      endHour: 10,
      endMinute: 30,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'volatile - docs bounce',
    },
    {
      startHour: 10,
      startMinute: 30,
      endHour: 11,
      endMinute: 15,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'volatile - feature push',
    },
    {
      startHour: 11,
      startMinute: 15,
      endHour: 11,
      endMinute: 50,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 11,
      startMinute: 50,
      endHour: 12,
      endMinute: 20,
      state: 'fading',
      appName: 'Slack',
      windowTitle: 'volatile - interruptions',
    },
    {
      startHour: 12,
      startMinute: 20,
      endHour: 13,
      endMinute: 5,
      state: 'locked',
      appName: 'Notion',
      windowTitle: 'volatile - focused planning',
    },
    {
      startHour: 13,
      startMinute: 5,
      endHour: 13,
      endMinute: 25,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 13,
      startMinute: 25,
      endHour: 14,
      endMinute: 10,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'volatile - hotfix run',
    },
    {
      startHour: 14,
      startMinute: 10,
      endHour: 14,
      endMinute: 40,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'volatile - rabbit hole',
    },
    {
      startHour: 14,
      startMinute: 40,
      endHour: 15,
      endMinute: 15,
      state: 'locked',
      appName: 'Terminal',
      windowTitle: 'volatile - tests + build',
    },
    {
      startHour: 15,
      startMinute: 15,
      endHour: 15,
      endMinute: 55,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
    {
      startHour: 15,
      startMinute: 55,
      endHour: 16,
      endMinute: 35,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'volatile - recovery focus',
    },
    {
      startHour: 16,
      startMinute: 35,
      endHour: 17,
      endMinute: 5,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'volatile - multitask drift',
    },
    {
      startHour: 17,
      startMinute: 5,
      endHour: 17,
      endMinute: 45,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'volatile - final burst',
    },
    {
      startHour: 17,
      startMinute: 45,
      endHour: 18,
      endMinute: 30,
      state: 'gone',
      appName: null,
      windowTitle: null,
    },
  ];
}

function buildDaySegments(scenario: SeedScenario, profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (scenario === 'set2') {
    return buildSet2DaySegments(profile);
  }

  if (scenario === 'set3') {
    return buildSet3DaySegments(profile);
  }

  if (scenario === 'absurd') {
    return buildAbsurdDaySegments(profile);
  }

  if (scenario === 'volatile') {
    return buildVolatileDaySegments(profile);
  }

  return buildBaselineDaySegments(profile);
}

function specToEvent(dayStartTs: number, spec: SegmentSpec): FocusEvent {
  const startTs = at(dayStartTs, spec.startHour, spec.startMinute);

  return {
    state: spec.state,
    appName: spec.appName,
    windowTitle: spec.windowTitle,
    ts: startTs,
  };
}

function withDayClosingGone(dayStartTs: number, events: FocusEvent[]): FocusEvent[] {
  const dayEndTs = endOfLocalDay(dayStartTs);
  const closingEvent: FocusEvent = {
    ts: dayEndTs - 1,
    state: 'gone',
    appName: null,
    windowTitle: null,
  };

  return [...events, closingEvent];
}

function main(): void {
  const dbPath = parseDbPath();
  const scenario = parseScenario();
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new FocusDatabase(dbPath);
  db.clearAll();

  const todayStart = startOfLocalDay(Date.now());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const yesterday = withDayClosingGone(
    yesterdayStart,
    buildDaySegments(scenario, 'yesterday').map((spec) => specToEvent(yesterdayStart, spec))
  );
  const today = withDayClosingGone(
    todayStart,
    buildDaySegments(scenario, 'today').map((spec) => specToEvent(todayStart, spec))
  );

  const allEvents = [...yesterday, ...today].sort((a, b) => a.ts - b.ts);

  for (const event of allEvents) {
    db.insertEvent(event.ts, event.state, event.appName, event.windowTitle);
  }

  const yesterdayReport = buildDayReportFromEvents(
    db.getEventsForRange(yesterdayStart, todayStart),
    db.getEventsForRange(yesterdayStart - 24 * 60 * 60 * 1000, yesterdayStart),
    yesterdayStart,
    todayStart
  );

  const todayReport = buildDayReportFromEvents(
    db.getEventsForRange(todayStart, endOfLocalDay(todayStart)),
    db.getEventsForRange(yesterdayStart, todayStart),
    todayStart,
    endOfLocalDay(todayStart)
  );

  db.upsertDailyReport(yesterdayReport);
  db.upsertDailyReport(todayReport);

  db.close();

  console.log(`Seeded ${allEvents.length} events into ${dbPath} using scenario=${scenario}`);
}

main();
