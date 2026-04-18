import { screen } from 'electron';
import activeWin from 'active-win';
import type { FocusEventInput, FocusState } from './types';
import { FocusStateClassifier, type FocusStateSnapshot } from './classifier';

interface FocusMonitorOptions {
  sampleIntervalMs?: number;
  onClassifiedState: (event: FocusEventInput) => void;
}

export class FocusMonitor {
  private readonly sampleIntervalMs: number;
  private readonly classifier = new FocusStateClassifier();
  private readonly onClassifiedState: (event: FocusEventInput) => void;

  private timer: NodeJS.Timeout | null = null;
  private lastCursorPoint: { x: number; y: number } | null = null;
  private lastEmitted: FocusStateSnapshot | null = null;

  constructor(options: FocusMonitorOptions) {
    this.sampleIntervalMs = options.sampleIntervalMs ?? 5_000;
    this.onClassifiedState = options.onClassifiedState;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.sampleIntervalMs);

    void this.tick();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  getCurrentState(): FocusState {
    return this.classifier.getCurrentState();
  }

  private async tick(): Promise<void> {
    const ts = Date.now();
    const currentPoint = screen.getCursorScreenPoint();

    const mouseDeltaPx = this.lastCursorPoint
      ? Math.hypot(currentPoint.x - this.lastCursorPoint.x, currentPoint.y - this.lastCursorPoint.y)
      : 0;

    this.lastCursorPoint = currentPoint;

    let appName: string | null = null;
    let windowTitle: string | null = null;

    try {
      const active = await activeWin();
      appName = active?.owner?.name ?? null;
      windowTitle = active?.title?.trim() || null;
    } catch {
      // Ignore transient active window errors (permissions/platform nuances).
    }

    const snapshot = this.classifier.update({
      ts,
      mouseDeltaPx,
      appName,
      windowTitle,
    });

    if (!this.shouldEmit(snapshot)) {
      return;
    }

    this.lastEmitted = snapshot;

    this.onClassifiedState({
      state: snapshot.state,
      appName: snapshot.appName ?? undefined,
      windowTitle: snapshot.windowTitle ?? undefined,
      ts: snapshot.ts,
    });
  }

  private shouldEmit(next: FocusStateSnapshot): boolean {
    if (!this.lastEmitted) {
      return true;
    }

    return (
      next.state !== this.lastEmitted.state ||
      next.appName !== this.lastEmitted.appName ||
      next.windowTitle !== this.lastEmitted.windowTitle
    );
  }
}
