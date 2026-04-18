import { BrowserWindow, ipcMain } from 'electron'
import { EventEmitter } from 'node:events'
import type {
  DeltaLocked,
  FocusDurations,
  FocusEvent,
  FocusEventInput,
  FocusSegment,
  FocusState,
  ReportsGenerateResponse,
  ReportsTodayResponse,
  TimelinePoint,
  TopAppItem
} from './types'
import { FOCUS_STATES } from './types'
import { clipDuration, endOfLocalDay, FIVE_MINUTES_MS, startOfLocalDay } from './time'
import { FocusDatabase } from './database'

interface ActiveSession {
  startTs: number
  state: FocusState
  appName: string | null
  windowTitle: string | null
}

interface FocusServiceOptions {
  pushIntervalMs?: number
}

export class FocusService {
  private readonly db: FocusDatabase
  private readonly emitter = new EventEmitter()
  private readonly pushIntervalMs: number

  private activeSession: ActiveSession | null = null
  private todaySegments: FocusSegment[] = []

  private currentState: FocusState = 'gone'
  private currentAppName: string | null = null
  private currentWindowTitle: string | null = null

  private pushTimer: NodeJS.Timeout | null = null

  constructor(dbPath: string, options?: FocusServiceOptions) {
    this.db = new FocusDatabase(dbPath)
    this.pushIntervalMs = options?.pushIntervalMs ?? 4000

    this.loadTodaySegments()
    this.registerIpc()
    this.startPushLoop()
  }

  private registerIpc(): void {
    ipcMain.handle('focus:ingest', (_event, payload: FocusEventInput) => this.ingest(payload))

    ipcMain.handle('reports:today', () => this.getTodayReport())

    ipcMain.handle('reports:generate', (_event, payload?: { dayStartTs?: number }) => {
      const dayStartTs = payload?.dayStartTs ?? startOfLocalDay(Date.now())
      return this.generateReportSnapshot(dayStartTs)
    })
  }

  private startPushLoop(): void {
    this.pushTimer = setInterval(() => {
      this.broadcastDashboardUpdate()
    }, this.pushIntervalMs)
  }

  private loadTodaySegments(): void {
    const now = Date.now()
    const dayStartTs = startOfLocalDay(now)
    const dayEndTs = endOfLocalDay(now)
    this.todaySegments = this.db.getSegmentsOverlapping(dayStartTs, dayEndTs)
  }

  private normalizeEvent(input: FocusEventInput): FocusEvent {
    if (!FOCUS_STATES.includes(input.state)) {
      throw new Error(`Invalid state: ${input.state}`)
    }

    return {
      state: input.state,
      appName: input.appName?.trim() || null,
      windowTitle: input.windowTitle?.trim() || null,
      ts: input.ts ?? Date.now()
    }
  }

  ingest(input: FocusEventInput): { ok: true } {
    const event = this.normalizeEvent(input)

    this.db.insertEvent(event.ts, event.state, event.appName, event.windowTitle)

    const isSameAsCurrent =
      this.activeSession !== null &&
      this.activeSession.state === event.state &&
      this.activeSession.appName === event.appName &&
      this.activeSession.windowTitle === event.windowTitle

    if (isSameAsCurrent) {
      this.updateCurrent(event)
      return { ok: true }
    }

    this.closeActiveSession(event.ts)

    this.activeSession = {
      startTs: event.ts,
      state: event.state,
      appName: event.appName,
      windowTitle: event.windowTitle
    }

    this.updateCurrent(event)
    this.broadcastDashboardUpdate()

    return { ok: true }
  }

  private updateCurrent(event: FocusEvent): void {
    this.currentState = event.state
    this.currentAppName = event.appName
    this.currentWindowTitle = event.windowTitle
  }

  private closeActiveSession(endTs: number): void {
    if (!this.activeSession || endTs <= this.activeSession.startTs) {
      return
    }

    const segment: FocusSegment = {
      state: this.activeSession.state,
      appName: this.activeSession.appName,
      windowTitle: this.activeSession.windowTitle,
      startTs: this.activeSession.startTs,
      endTs,
      durationMs: endTs - this.activeSession.startTs
    }

    this.db.insertSegment(segment)
    this.appendTodaySegment(segment)
  }

  private appendTodaySegment(segment: FocusSegment): void {
    const dayStartTs = startOfLocalDay(Date.now())
    const dayEndTs = endOfLocalDay(Date.now())

    if (segment.endTs <= dayStartTs || segment.startTs >= dayEndTs) {
      return
    }

    this.todaySegments.push(segment)
  }

  private getLiveTodaySegments(nowTs: number): FocusSegment[] {
    const dayStartTs = startOfLocalDay(nowTs)
    const dayEndTs = endOfLocalDay(nowTs)

    const segments = this.todaySegments.filter(
      (segment) => segment.endTs > dayStartTs && segment.startTs < dayEndTs
    )

    if (this.activeSession) {
      const virtualSegment: FocusSegment = {
        state: this.activeSession.state,
        appName: this.activeSession.appName,
        windowTitle: this.activeSession.windowTitle,
        startTs: this.activeSession.startTs,
        endTs: nowTs,
        durationMs: Math.max(0, nowTs - this.activeSession.startTs)
      }

      if (virtualSegment.endTs > virtualSegment.startTs) {
        segments.push(virtualSegment)
      }
    }

    return segments
  }

  private calculateDurations(segments: FocusSegment[], rangeStart: number, rangeEnd: number): FocusDurations {
    const durations: Record<FocusState, number> = {
      locked: 0,
      fading: 0,
      gone: 0
    }

    for (const segment of segments) {
      durations[segment.state] += clipDuration(segment.startTs, segment.endTs, rangeStart, rangeEnd)
    }

    return {
      lockedMs: durations.locked,
      fadingMs: durations.fading,
      goneMs: durations.gone,
      totalMs: durations.locked + durations.fading + durations.gone
    }
  }

  private buildTimeline(segments: FocusSegment[], rangeStart: number, rangeEnd: number): TimelinePoint[] {
    const points: TimelinePoint[] = []

    for (let bucketStart = rangeStart; bucketStart < rangeEnd; bucketStart += FIVE_MINUTES_MS) {
      const state = this.resolveStateAtTs(segments, bucketStart)
      points.push({ bucketStart, state })
    }

    return points
  }

  private resolveStateAtTs(segments: FocusSegment[], ts: number): FocusState {
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i]
      if (segment.startTs <= ts && segment.endTs > ts) {
        return segment.state
      }
    }

    return 'gone'
  }

  private buildTopApps(segments: FocusSegment[], rangeStart: number, rangeEnd: number): TopAppItem[] {
    const durationsByApp = new Map<string, number>()

    for (const segment of segments) {
      if (segment.state !== 'locked') {
        continue
      }

      const duration = clipDuration(segment.startTs, segment.endTs, rangeStart, rangeEnd)
      if (duration <= 0) {
        continue
      }

      const key = segment.appName || 'Unknown'
      durationsByApp.set(key, (durationsByApp.get(key) ?? 0) + duration)
    }

    return [...durationsByApp.entries()]
      .map(([appName, durationMs]) => ({ appName, durationMs }))
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 3)
  }

  private buildDelta(todayLockedMs: number, yesterdayLockedMs: number): DeltaLocked {
    let percentChange: number | null = null

    if (yesterdayLockedMs > 0) {
      percentChange = ((todayLockedMs - yesterdayLockedMs) / yesterdayLockedMs) * 100
    } else if (todayLockedMs > 0) {
      percentChange = 100
    }

    return {
      todayLockedMs,
      yesterdayLockedMs,
      percentChange
    }
  }

  getTodayReport(): ReportsTodayResponse {
    const nowTs = Date.now()
    const dayStartTs = startOfLocalDay(nowTs)

    const todaySegments = this.getLiveTodaySegments(nowTs).sort((a, b) => a.startTs - b.startTs)
    const stats = this.calculateDurations(todaySegments, dayStartTs, nowTs)
    const timeline = this.buildTimeline(todaySegments, dayStartTs, nowTs)
    const topApps = this.buildTopApps(todaySegments, dayStartTs, nowTs)

    const yesterdayStartTs = dayStartTs - 24 * 60 * 60 * 1000
    const yesterdayEndTs = dayStartTs
    const yesterdayDurations = this.db.getDurations(yesterdayStartTs, yesterdayEndTs)

    const delta = this.buildDelta(stats.lockedMs, yesterdayDurations.locked)

    return {
      nowTs,
      currentState: this.currentState,
      currentAppName: this.currentAppName,
      currentWindowTitle: this.currentWindowTitle,
      timeline,
      stats,
      delta,
      topApps
    }
  }

  generateReportSnapshot(dayStartTs: number): ReportsGenerateResponse {
    const normalizedStart = startOfLocalDay(dayStartTs)
    const dayEndTs = endOfLocalDay(normalizedStart)

    const durations = this.db.getDurations(normalizedStart, dayEndTs)
    const yesterdayDurations = this.db.getDurations(
      normalizedStart - 24 * 60 * 60 * 1000,
      normalizedStart
    )

    return {
      generatedAtTs: Date.now(),
      dayStartTs: normalizedStart,
      dayEndTs,
      timeline: this.db.getTimeline(normalizedStart, dayEndTs),
      stats: {
        lockedMs: durations.locked,
        fadingMs: durations.fading,
        goneMs: durations.gone,
        totalMs: durations.locked + durations.fading + durations.gone
      },
      yesterdayStats: {
        lockedMs: yesterdayDurations.locked,
        fadingMs: yesterdayDurations.fading,
        goneMs: yesterdayDurations.gone,
        totalMs: yesterdayDurations.locked + yesterdayDurations.fading + yesterdayDurations.gone
      },
      delta: this.buildDelta(durations.locked, yesterdayDurations.locked),
      topApps: this.db.getTopAppsLocked(normalizedStart, dayEndTs)
    }
  }

  private broadcastDashboardUpdate(): void {
    const payload = this.getTodayReport()
    this.emitter.emit('dashboard:update', payload)

    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('dashboard:update', payload)
    }
  }

  shutdown(): void {
    this.closeActiveSession(Date.now())

    if (this.pushTimer) {
      clearInterval(this.pushTimer)
      this.pushTimer = null
    }

    this.db.close()
  }
}
