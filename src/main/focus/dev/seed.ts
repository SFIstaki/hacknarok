import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { FocusDatabase } from '../database'
import { endOfLocalDay, startOfLocalDay } from '../time'
import type { FocusEvent, FocusState } from '../types'
import { buildDayReportFromEvents } from '../analytics'

interface SegmentSpec {
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  state: FocusState
  appName: string | null
  windowTitle: string | null
}

const DEFAULT_DB_PATH = resolve(process.cwd(), 'tmp/focus-monitor.seed.db')

function parseDbPath(): string {
  const dbArg = process.argv.find((arg) => arg.startsWith('--db='))
  return dbArg ? resolve(process.cwd(), dbArg.replace('--db=', '')) : DEFAULT_DB_PATH
}

function at(dayStartTs: number, hour: number, minute: number): number {
  return dayStartTs + (hour * 60 + minute) * 60_000
}

function buildDaySegments(profile: 'yesterday' | 'today'): SegmentSpec[] {
  if (profile === 'yesterday') {
    return [
      {
        startHour: 8,
        startMinute: 30,
        endHour: 10,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - backend'
      },
      {
        startHour: 10,
        startMinute: 0,
        endHour: 10,
        endMinute: 20,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'YouTube'
      },
      {
        startHour: 10,
        startMinute: 20,
        endHour: 12,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - pipeline'
      },
      {
        startHour: 12,
        startMinute: 0,
        endHour: 12,
        endMinute: 30,
        state: 'gone',
        appName: null,
        windowTitle: null
      },
      {
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 0,
        state: 'locked',
        appName: 'Notion',
        windowTitle: 'Sprint plan'
      },
      {
        startHour: 14,
        startMinute: 0,
        endHour: 14,
        endMinute: 25,
        state: 'fading',
        appName: 'Google Chrome',
        windowTitle: 'Docs / Slack / Jira'
      },
      {
        startHour: 14,
        startMinute: 25,
        endHour: 16,
        endMinute: 0,
        state: 'locked',
        appName: 'Visual Studio Code',
        windowTitle: 'presently - analytics'
      }
    ]
  }

  return [
    {
      startHour: 8,
      startMinute: 30,
      endHour: 11,
      endMinute: 15,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'presently - focus monitor'
    },
    {
      startHour: 11,
      startMinute: 15,
      endHour: 11,
      endMinute: 40,
      state: 'fading',
      appName: 'Google Chrome',
      windowTitle: 'YouTube / Chat'
    },
    {
      startHour: 11,
      startMinute: 40,
      endHour: 13,
      endMinute: 0,
      state: 'locked',
      appName: 'Visual Studio Code',
      windowTitle: 'presently - reports API'
    },
    {
      startHour: 13,
      startMinute: 0,
      endHour: 13,
      endMinute: 40,
      state: 'gone',
      appName: null,
      windowTitle: null
    },
    {
      startHour: 13,
      startMinute: 40,
      endHour: 16,
      endMinute: 0,
      state: 'locked',
      appName: 'Terminal',
      windowTitle: 'npm run build'
    }
  ]
}

function specToEvent(dayStartTs: number, spec: SegmentSpec): FocusEvent {
  const startTs = at(dayStartTs, spec.startHour, spec.startMinute)

  return {
    state: spec.state,
    appName: spec.appName,
    windowTitle: spec.windowTitle,
    ts: startTs
  }
}

function main(): void {
  const dbPath = parseDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new FocusDatabase(dbPath)
  db.clearAll()

  const todayStart = startOfLocalDay(Date.now())
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000

  const yesterday = buildDaySegments('yesterday').map((spec) => specToEvent(yesterdayStart, spec))
  const today = buildDaySegments('today').map((spec) => specToEvent(todayStart, spec))

  const allEvents = [...yesterday, ...today].sort((a, b) => a.ts - b.ts)

  for (const event of allEvents) {
    db.insertEvent(event.ts, event.state, event.appName, event.windowTitle)
  }

  const yesterdayReport = buildDayReportFromEvents(
    db.getEventsForRange(yesterdayStart, todayStart),
    db.getEventsForRange(yesterdayStart - 24 * 60 * 60 * 1000, yesterdayStart),
    yesterdayStart,
    todayStart
  )

  const todayReport = buildDayReportFromEvents(
    db.getEventsForRange(todayStart, endOfLocalDay(todayStart)),
    db.getEventsForRange(yesterdayStart, todayStart),
    todayStart,
    endOfLocalDay(todayStart)
  )

  db.upsertDailyReport(yesterdayReport)
  db.upsertDailyReport(todayReport)

  db.close()

  console.log(`Seeded ${allEvents.length} events into ${dbPath}`)
}

main()
