export const FOCUS_STATES = ['locked', 'fading', 'gone'] as const

export type FocusState = (typeof FOCUS_STATES)[number]

export interface FocusEventInput {
  state: FocusState
  appName?: string
  windowTitle?: string
  ts?: number
}

export interface FocusEvent {
  state: FocusState
  appName: string | null
  windowTitle: string | null
  ts: number
}

export interface TimelinePoint {
  bucketStart: number
  state: FocusState
}

export interface FocusDurations {
  lockedMs: number
  fadingMs: number
  goneMs: number
  totalMs: number
}

export interface TopAppItem {
  appName: string
  durationMs: number
}

export interface DeltaLocked {
  todayLockedMs: number
  yesterdayLockedMs: number
  percentChange: number | null
}

export interface ReportsTodayResponse {
  nowTs: number
  currentState: FocusState
  currentAppName: string | null
  currentWindowTitle: string | null
  timeline: TimelinePoint[]
  stats: FocusDurations
  delta: DeltaLocked
  topApps: TopAppItem[]
}

export interface ReportsGenerateResponse {
  generatedAtTs: number
  dayStartTs: number
  dayEndTs: number
  timeline: TimelinePoint[]
  stats: FocusDurations
  yesterdayStats: FocusDurations
  delta: DeltaLocked
  topApps: TopAppItem[]
}
