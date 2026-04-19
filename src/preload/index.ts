import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

interface PreferencesPayload {
  username: string;
  userType: string;
  usageTypes: string[];
  alertSensitivity: number;
}
export type FocusState = 'locked' | 'fading' | 'gone';

export interface FocusEventInput {
  state: FocusState;
  appName?: string;
  windowTitle?: string;
  ts?: number;
}

export interface TimelinePoint {
  bucketStart: number;
  state: FocusState;
}

export interface FocusDurations {
  lockedMs: number;
  fadingMs: number;
  goneMs: number;
  totalMs: number;
}

export interface ReportsTodayResponse {
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

export interface ReportsGenerateResponse {
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

export interface DashboardApi {
  ingestFocusEvent: (payload: FocusEventInput) => Promise<{ ok: true }>;
  getTodayReport: () => Promise<ReportsTodayResponse>;
  generateReport: (payload?: { dayStartTs?: number }) => Promise<ReportsGenerateResponse>;
  onDashboardUpdate: (listener: (payload: ReportsTodayResponse) => void) => () => void;
}

// Custom APIs for renderer
const api: DashboardApi & {
  sendFocusAlert: (behavior: string, lang: string) => void;
  dismissNotification: () => void;
} = {
  sendFocusAlert: (behavior: string, lang: string): void => {
    ipcRenderer.send('focus-alert', { behavior, lang });
  },
  dismissNotification: (): void => {
    ipcRenderer.send('notify:dismiss');
  },
  ingestFocusEvent: (payload) => ipcRenderer.invoke('focus:ingest', payload),
  getTodayReport: () => ipcRenderer.invoke('reports:today'),
  generateReport: (payload) => ipcRenderer.invoke('reports:generate', payload),
  onDashboardUpdate: (listener) => {
    const wrappedListener = (_event: IpcRendererEvent, payload: ReportsTodayResponse): void => {
      listener(payload);
    };
    ipcRenderer.on('dashboard:update', wrappedListener);
    return () => {
      ipcRenderer.removeListener('dashboard:update', wrappedListener);
    };
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
