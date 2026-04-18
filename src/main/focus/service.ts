import { BrowserWindow, ipcMain } from 'electron';
import type {
  FocusEvent,
  FocusEventInput,
  FocusState,
  ReportsGenerateResponse,
  ReportsTodayResponse,
} from './types';
import { FOCUS_STATES } from './types';
import { endOfLocalDay, startOfLocalDay } from './time';
import { FocusDatabase } from './database';
import { buildDayReportFromEvents } from './analytics';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 60;

export class FocusService {
  private readonly db: FocusDatabase;

  private currentState: FocusState = 'gone';
  private currentAppName: string | null = null;
  private currentWindowTitle: string | null = null;

  private dailySnapshotTimer: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.db = new FocusDatabase(dbPath);

    this.registerIpc();
    this.cleanupOldData(DEFAULT_RETENTION_DAYS);
    this.scheduleDailySnapshot();
  }

  private registerIpc(): void {
    ipcMain.handle('focus:ingest', (_event, payload: FocusEventInput) => this.ingest(payload));

    ipcMain.handle('reports:today', () => this.getTodayReport());

    ipcMain.handle('reports:generate', (_event, payload?: { dayStartTs?: number }) => {
      const dayStartTs = payload?.dayStartTs ?? startOfLocalDay(Date.now());
      return this.generateReportSnapshot(dayStartTs);
    });
  }

  private normalizeEvent(input: FocusEventInput): FocusEvent {
    if (!FOCUS_STATES.includes(input.state)) {
      throw new Error(`Invalid state: ${input.state}`);
    }

    return {
      state: input.state,
      appName: input.appName?.trim() || null,
      windowTitle: input.windowTitle?.trim() || null,
      ts: input.ts ?? Date.now(),
    };
  }

  ingest(input: FocusEventInput): { ok: true } {
    const event = this.normalizeEvent(input);

    this.db.insertEvent(event.ts, event.state, event.appName, event.windowTitle);

    this.updateCurrent(event);

    return { ok: true };
  }

  private updateCurrent(event: FocusEvent): void {
    this.currentState = event.state;
    this.currentAppName = event.appName;
    this.currentWindowTitle = event.windowTitle;
  }

  getTodayReport(): ReportsTodayResponse {
    const nowTs = Date.now();
    const dayStartTs = startOfLocalDay(nowTs);
    const snapshot = this.db.getDailyReport(dayStartTs);
    const latestSnapshot = this.db.getLatestDailyReportMeta();

    return {
      nowTs,
      currentState: this.currentState,
      currentAppName: this.currentAppName,
      currentWindowTitle: this.currentWindowTitle,
      reportStatus: {
        hasTodaySnapshot: snapshot !== null,
        latestSnapshotGeneratedAtTs: latestSnapshot?.generatedAtTs ?? null,
        latestSnapshotDayStartTs: latestSnapshot?.dayStartTs ?? null,
        latestSnapshotDayEndTs: latestSnapshot?.dayEndTs ?? null,
      },
      timeline: snapshot?.timeline ?? [],
      stats: snapshot?.stats ?? { lockedMs: 0, fadingMs: 0, goneMs: 0, totalMs: 0 },
      delta: snapshot?.delta ?? { todayLockedMs: 0, yesterdayLockedMs: 0, percentChange: null },
      topApps: snapshot?.topApps ?? [],
    };
  }

  generateReportSnapshot(dayStartTs: number): ReportsGenerateResponse {
    const normalizedStart = startOfLocalDay(dayStartTs);
    const dayEndTs = endOfLocalDay(normalizedStart);
    const yesterdayStart = normalizedStart - ONE_DAY_MS;

    const eventsForDay = this.db.getEventsForRange(normalizedStart, dayEndTs);
    const eventsForYesterday = this.db.getEventsForRange(yesterdayStart, normalizedStart);

    const report = buildDayReportFromEvents(
      eventsForDay,
      eventsForYesterday,
      normalizedStart,
      dayEndTs
    );
    this.db.upsertDailyReport(report);
    this.cleanupOldData(DEFAULT_RETENTION_DAYS);
    this.broadcastDashboardUpdate();

    return report;
  }

  private broadcastDashboardUpdate(): void {
    const payload = this.getTodayReport();

    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('dashboard:update', payload);
    }
  }

  private scheduleDailySnapshot(): void {
    const nowTs = Date.now();
    const nextMidnight = endOfLocalDay(nowTs);
    const delayMs = Math.max(1_000, nextMidnight - nowTs + 1_000);

    this.dailySnapshotTimer = setTimeout(() => {
      const dayToFinalize = startOfLocalDay(Date.now() - 60_000);
      this.generateReportSnapshot(dayToFinalize);
      this.scheduleDailySnapshot();
    }, delayMs);
  }

  private cleanupOldData(retentionDays: number): void {
    const normalizedRetentionDays = Math.max(1, retentionDays);
    const cutoffTs = startOfLocalDay(Date.now()) - normalizedRetentionDays * ONE_DAY_MS;
    this.db.deleteDataOlderThan(cutoffTs);
  }

  shutdown(): void {
    if (this.dailySnapshotTimer) {
      clearTimeout(this.dailySnapshotTimer);
      this.dailySnapshotTimer = null;
    }

    this.db.close();
  }
}
