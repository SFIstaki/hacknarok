import { ElectronAPI } from '@electron-toolkit/preload';

type FocusState = 'locked' | 'fading' | 'gone';

interface FocusEventInput {
  state: FocusState;
  appName?: string;
  windowTitle?: string;
  ts?: number;
}

interface TimelinePoint {
  bucketStart: number;
  state: FocusState;
}

interface FocusDurations {
  lockedMs: number;
  fadingMs: number;
  goneMs: number;
  totalMs: number;
}

interface ReportsTodayResponse {
  nowTs: number;
  currentState: FocusState;
  currentAppName: string | null;
  currentWindowTitle: string | null;
  reportStatus: {
    hasTodaySnapshot: boolean;
    latestSnapshotGeneratedAtTs: number | null;
    latestSnapshotDayStartTs: number | null;
    latestSnapshotDayEndTs: number | null;
  };
  timeline: TimelinePoint[];
  stats: FocusDurations;
  delta: {
    todayLockedMs: number;
    yesterdayLockedMs: number;
    percentChange: number | null;
  };
  topApps: Array<{ appName: string; durationMs: number }>;
}

interface ReportsGenerateResponse {
  generatedAtTs: number;
  dayStartTs: number;
  dayEndTs: number;
  timeline: TimelinePoint[];
  stats: FocusDurations;
  yesterdayStats: FocusDurations;
  delta: {
    todayLockedMs: number;
    yesterdayLockedMs: number;
    percentChange: number | null;
  };
  topApps: Array<{ appName: string; durationMs: number }>;
}

interface PoseResult {
  lineStart: { x: number; y: number };
  lineEnd: { x: number; y: number };
}

interface DashboardApi {
  ingestFocusEvent: (payload: FocusEventInput) => Promise<{ ok: true }>;
  getTodayReport: () => Promise<ReportsTodayResponse>;
  generateReport: (payload?: { dayStartTs?: number }) => Promise<ReportsGenerateResponse>;
  onDashboardUpdate: (listener: (payload: ReportsTodayResponse) => void) => () => void;
  detectFaces: (payload: { data: Uint8Array; width: number; height: number }) => Promise<PoseResult | null>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: DashboardApi;
  }
}
