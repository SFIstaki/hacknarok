import Database from 'better-sqlite3'
import type { FocusSegment, FocusState, TimelinePoint, TopAppItem } from './types'
import { FIVE_MINUTES_MS } from './time'

interface DurationRow {
  state: FocusState
  durationMs: number
}

interface TopAppRow {
  appName: string
  durationMs: number
}

export class FocusDatabase {
  private readonly db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS focus_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        state TEXT NOT NULL,
        app_name TEXT,
        window_title TEXT
      );

      CREATE TABLE IF NOT EXISTS focus_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        state TEXT NOT NULL,
        app_name TEXT,
        window_title TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_focus_events_ts ON focus_events(ts);
      CREATE INDEX IF NOT EXISTS idx_focus_segments_start ON focus_segments(start_ts);
      CREATE INDEX IF NOT EXISTS idx_focus_segments_end ON focus_segments(end_ts);
      CREATE INDEX IF NOT EXISTS idx_focus_segments_state ON focus_segments(state);
    `)
  }

  close(): void {
    this.db.close()
  }

  insertEvent(ts: number, state: FocusState, appName: string | null, windowTitle: string | null): void {
    const statement = this.db.prepare(
      `INSERT INTO focus_events (ts, state, app_name, window_title) VALUES (@ts, @state, @appName, @windowTitle)`
    )

    statement.run({ ts, state, appName, windowTitle })
  }

  insertSegment(segment: FocusSegment): void {
    const statement = this.db.prepare(`
      INSERT INTO focus_segments (start_ts, end_ts, duration_ms, state, app_name, window_title)
      VALUES (@startTs, @endTs, @durationMs, @state, @appName, @windowTitle)
    `)

    statement.run(segment)
  }

  getSegmentsOverlapping(rangeStart: number, rangeEnd: number): FocusSegment[] {
    const statement = this.db.prepare(
      `
      SELECT start_ts as startTs, end_ts as endTs, duration_ms as durationMs, state, app_name as appName, window_title as windowTitle
      FROM focus_segments
      WHERE end_ts > @rangeStart AND start_ts < @rangeEnd
      ORDER BY start_ts ASC
    `
    )

    return statement.all({ rangeStart, rangeEnd }) as FocusSegment[]
  }

  getDurations(rangeStart: number, rangeEnd: number): Record<FocusState, number> {
    const statement = this.db.prepare(
      `
      SELECT state, SUM(MAX(0, MIN(end_ts, @rangeEnd) - MAX(start_ts, @rangeStart))) as durationMs
      FROM focus_segments
      WHERE end_ts > @rangeStart AND start_ts < @rangeEnd
      GROUP BY state
    `
    )

    const rows = statement.all({ rangeStart, rangeEnd }) as DurationRow[]
    const output: Record<FocusState, number> = {
      locked: 0,
      fading: 0,
      gone: 0
    }

    for (const row of rows) {
      output[row.state] = row.durationMs ?? 0
    }

    return output
  }

  getTopAppsLocked(rangeStart: number, rangeEnd: number, limit = 3): TopAppItem[] {
    const statement = this.db.prepare(
      `
      SELECT
        COALESCE(NULLIF(app_name, ''), 'Unknown') as appName,
        SUM(MAX(0, MIN(end_ts, @rangeEnd) - MAX(start_ts, @rangeStart))) as durationMs
      FROM focus_segments
      WHERE state = 'locked' AND end_ts > @rangeStart AND start_ts < @rangeEnd
      GROUP BY appName
      ORDER BY durationMs DESC
      LIMIT @limit
    `
    )

    return statement.all({ rangeStart, rangeEnd, limit }) as TopAppRow[]
  }

  getTimeline(rangeStart: number, rangeEnd: number, bucketMs = FIVE_MINUTES_MS): TimelinePoint[] {
    const statement = this.db.prepare(
      `
      WITH RECURSIVE buckets(ts) AS (
        VALUES (@rangeStart)
        UNION ALL
        SELECT ts + @bucketMs FROM buckets WHERE ts + @bucketMs < @rangeEnd
      )
      SELECT
        b.ts as bucketStart,
        COALESCE((
          SELECT s.state
          FROM focus_segments s
          WHERE s.start_ts <= b.ts AND s.end_ts > b.ts
          ORDER BY s.start_ts DESC
          LIMIT 1
        ), 'gone') as state
      FROM buckets b
      ORDER BY b.ts ASC
    `
    )

    return statement.all({ rangeStart, rangeEnd, bucketMs }) as TimelinePoint[]
  }
}
