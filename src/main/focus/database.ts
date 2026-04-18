import Database from 'better-sqlite3'
import type { FocusEvent, FocusState, ReportsGenerateResponse } from './types'

interface FocusEventRow {
  ts: number
  state: FocusState
  appName: string | null
  windowTitle: string | null
}

interface DailyReportRow {
  generatedAtTs: number
  dayStartTs: number
  dayEndTs: number
  timelineJson: string
  statsJson: string
  yesterdayStatsJson: string
  deltaJson: string
  topAppsJson: string
}

interface DailyReportMetaRow {
  generatedAtTs: number
  dayStartTs: number
  dayEndTs: number
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

      CREATE TABLE IF NOT EXISTS daily_reports (
        day_start_ts INTEGER PRIMARY KEY,
        generated_at_ts INTEGER NOT NULL,
        day_end_ts INTEGER NOT NULL,
        timeline_json TEXT NOT NULL,
        stats_json TEXT NOT NULL,
        yesterday_stats_json TEXT NOT NULL,
        delta_json TEXT NOT NULL,
        top_apps_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_focus_events_ts ON focus_events(ts);
      CREATE INDEX IF NOT EXISTS idx_daily_reports_day_start ON daily_reports(day_start_ts);
    `)
  }

  close(): void {
    this.db.close()
  }

  clearAll(): void {
    this.db.exec(`
      DELETE FROM focus_events;
      DELETE FROM daily_reports;
    `)
  }

  insertEvent(ts: number, state: FocusState, appName: string | null, windowTitle: string | null): void {
    const statement = this.db.prepare(
      `INSERT INTO focus_events (ts, state, app_name, window_title) VALUES (@ts, @state, @appName, @windowTitle)`
    )

    statement.run({ ts, state, appName, windowTitle })
  }

  getEventsForRange(rangeStart: number, rangeEnd: number): FocusEvent[] {
    const statement = this.db.prepare(`
      SELECT ts, state, app_name as appName, window_title as windowTitle
      FROM focus_events
      WHERE ts >= @rangeStart AND ts < @rangeEnd
      ORDER BY ts ASC
    `)

    const previousStatement = this.db.prepare(`
      SELECT ts, state, app_name as appName, window_title as windowTitle
      FROM focus_events
      WHERE ts < @rangeStart
      ORDER BY ts DESC
      LIMIT 1
    `)

    const inRange = statement.all({ rangeStart, rangeEnd }) as FocusEventRow[]
    const previous = previousStatement.get({ rangeStart }) as FocusEventRow | undefined

    if (!previous) {
      return inRange
    }

    return [previous, ...inRange]
  }

  upsertDailyReport(report: ReportsGenerateResponse): void {
    const statement = this.db.prepare(
      `
      INSERT INTO daily_reports (
        day_start_ts,
        generated_at_ts,
        day_end_ts,
        timeline_json,
        stats_json,
        yesterday_stats_json,
        delta_json,
        top_apps_json
      ) VALUES (
        @dayStartTs,
        @generatedAtTs,
        @dayEndTs,
        @timelineJson,
        @statsJson,
        @yesterdayStatsJson,
        @deltaJson,
        @topAppsJson
      )
      ON CONFLICT(day_start_ts) DO UPDATE SET
        generated_at_ts = excluded.generated_at_ts,
        day_end_ts = excluded.day_end_ts,
        timeline_json = excluded.timeline_json,
        stats_json = excluded.stats_json,
        yesterday_stats_json = excluded.yesterday_stats_json,
        delta_json = excluded.delta_json,
        top_apps_json = excluded.top_apps_json
    `
    )

    statement.run({
      dayStartTs: report.dayStartTs,
      generatedAtTs: report.generatedAtTs,
      dayEndTs: report.dayEndTs,
      timelineJson: JSON.stringify(report.timeline),
      statsJson: JSON.stringify(report.stats),
      yesterdayStatsJson: JSON.stringify(report.yesterdayStats),
      deltaJson: JSON.stringify(report.delta),
      topAppsJson: JSON.stringify(report.topApps)
    })
  }

  getDailyReport(dayStartTs: number): ReportsGenerateResponse | null {
    const statement = this.db.prepare(
      `
      SELECT
        generated_at_ts as generatedAtTs,
        day_start_ts as dayStartTs,
        day_end_ts as dayEndTs,
        timeline_json as timelineJson,
        stats_json as statsJson,
        yesterday_stats_json as yesterdayStatsJson,
        delta_json as deltaJson,
        top_apps_json as topAppsJson
      FROM daily_reports
      WHERE day_start_ts = @dayStartTs
      LIMIT 1
    `
    )

    const row = statement.get({ dayStartTs }) as DailyReportRow | undefined

    if (!row) {
      return null
    }

    return {
      generatedAtTs: row.generatedAtTs,
      dayStartTs: row.dayStartTs,
      dayEndTs: row.dayEndTs,
      timeline: JSON.parse(row.timelineJson),
      stats: JSON.parse(row.statsJson),
      yesterdayStats: JSON.parse(row.yesterdayStatsJson),
      delta: JSON.parse(row.deltaJson),
      topApps: JSON.parse(row.topAppsJson)
    }
  }

  getLatestDailyReportMeta(): DailyReportMetaRow | null {
    const statement = this.db.prepare(`
      SELECT
        generated_at_ts as generatedAtTs,
        day_start_ts as dayStartTs,
        day_end_ts as dayEndTs
      FROM daily_reports
      ORDER BY day_start_ts DESC
      LIMIT 1
    `)

    const row = statement.get() as DailyReportMetaRow | undefined
    return row ?? null
  }

  deleteDataOlderThan(cutoffTs: number): { deletedEvents: number; deletedReports: number } {
    const deleteEventsStatement = this.db.prepare(`DELETE FROM focus_events WHERE ts < @cutoffTs`)
    const deleteReportsStatement = this.db.prepare(
      `DELETE FROM daily_reports WHERE day_end_ts <= @cutoffTs`
    )

    const deletedEvents = deleteEventsStatement.run({ cutoffTs }).changes
    const deletedReports = deleteReportsStatement.run({ cutoffTs }).changes

    return {
      deletedEvents,
      deletedReports
    }
  }
}
