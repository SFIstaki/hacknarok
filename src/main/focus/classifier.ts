import type { FocusState } from './types';

export interface MonitorSample {
  ts: number;
  mouseDeltaPx: number;
  appName: string | null;
  windowTitle: string | null;
}

export interface FocusStateSnapshot {
  state: FocusState;
  appName: string | null;
  windowTitle: string | null;
  ts: number;
}

export class FocusStateClassifier {
  private readonly history: MonitorSample[] = [];
  private currentState: FocusState = 'gone';

  update(sample: MonitorSample): FocusStateSnapshot {
    this.history.push(sample);
    this.trimHistory(sample.ts);

    const recent = this.history.filter((item) => item.ts >= sample.ts - 60_000);
    const windowSwitches = this.countWindowSwitches(recent);
    const averageMouseDelta = this.averageMouseDelta(recent);
    const inactivityMs = this.calculateInactivityMs(sample.ts);

    let state: FocusState = 'fading';

    if (inactivityMs >= 60_000 || averageMouseDelta < 2) {
      state = 'gone';
    } else if (windowSwitches >= 4) {
      state = 'fading';
    } else if (averageMouseDelta >= 2 && averageMouseDelta <= 500 && windowSwitches <= 1) {
      state = 'locked';
    }

    this.currentState = state;

    return {
      state,
      appName: sample.appName,
      windowTitle: sample.windowTitle,
      ts: sample.ts,
    };
  }

  getCurrentState(): FocusState {
    return this.currentState;
  }

  private trimHistory(nowTs: number): void {
    const minTs = nowTs - 5 * 60_000;

    while (this.history.length > 0 && this.history[0].ts < minTs) {
      this.history.shift();
    }
  }

  private countWindowSwitches(samples: MonitorSample[]): number {
    let switches = 0;

    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1];
      const next = samples[i];

      const appChanged = prev.appName !== next.appName;
      const titleChanged = prev.windowTitle !== next.windowTitle;

      if (appChanged || titleChanged) {
        switches += 1;
      }
    }

    return switches;
  }

  private averageMouseDelta(samples: MonitorSample[]): number {
    if (samples.length === 0) {
      return 0;
    }

    const total = samples.reduce((sum, item) => sum + item.mouseDeltaPx, 0);
    return total / samples.length;
  }

  private calculateInactivityMs(nowTs: number): number {
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      if (this.history[i].mouseDeltaPx >= 2) {
        return nowTs - this.history[i].ts;
      }
    }

    return Number.POSITIVE_INFINITY;
  }
}
