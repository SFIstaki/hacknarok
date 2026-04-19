import { app, shell, BrowserWindow, ipcMain, screen } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { FocusService } from './focus/service';
import { FocusMonitor } from './focus/monitor';

let focusService: FocusService | null = null;
interface PreferencesPayload {
  username: string;
  userType: string;
  usageTypes: string[];
  alertSensitivity: number;
}

function isValidPreferencesPayload(payload: unknown): payload is PreferencesPayload {
  if (!payload || typeof payload !== 'object') return false;

  const candidate = payload as Partial<PreferencesPayload>;
  return (
    typeof candidate.username === 'string' &&
    candidate.username.trim().length > 0 &&
    typeof candidate.userType === 'string' &&
    candidate.userType.trim().length > 0 &&
    Array.isArray(candidate.usageTypes) &&
    candidate.usageTypes.length > 0 &&
    candidate.usageTypes.every((item) => typeof item === 'string' && item.trim().length > 0) &&
    typeof candidate.alertSensitivity === 'number' &&
    Number.isFinite(candidate.alertSensitivity)
  );
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}
let focusMonitor: FocusMonitor | null = null;

let mainWindow: BrowserWindow | null = null;

// ─── Custom notification window ───────────────────────────────────────────────

const BEHAVIOR_CONTENT: Record<string, { title: string; body: string; accent: string }> = {
  faceAbsent: {
    title: 'Where did you go?',
    body: "We can't see you. Still at your desk?",
    accent: '#e53e3e',
  },
  eyesClosed: {
    title: 'Feeling drowsy?',
    body: 'Your eyes have been closed for a while.',
    accent: '#805ad5',
  },
  yawning: {
    title: 'Big yawn!',
    body: 'Take a short break or grab some water.',
    accent: '#d69e2e',
  },
  lookingAway: {
    title: 'Eyes drifting...',
    body: 'Your gaze wandered from the screen.',
    accent: '#ed8936',
  },
  headTurned: {
    title: 'Head turned away',
    body: 'You seem to be looking elsewhere.',
    accent: '#3182ce',
  },
  test: {
    title: 'Test notification',
    body: 'Presently notifications are working!',
    accent: '#5dbae0',
  },
};

// ─── SFIstak mascot SVG variants ──────────────────────────────────────────────

const B = '#8B5E3C';
const M = '#D4A574';
const D = '#2D1000';

const mk = (eyes: string, mouth: string, extra = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="56" height="56">` +
  `<ellipse cx="10" cy="12" rx="6" ry="7" fill="${B}"/>` +
  `<ellipse cx="10" cy="12" rx="4" ry="5" fill="${M}"/>` +
  `<ellipse cx="38" cy="12" rx="6" ry="7" fill="${B}"/>` +
  `<ellipse cx="38" cy="12" rx="4" ry="5" fill="${M}"/>` +
  `<ellipse cx="24" cy="24" rx="18" ry="17" fill="${B}"/>` +
  `<ellipse cx="24" cy="31" rx="12" ry="9" fill="${M}"/>` +
  `<ellipse cx="24" cy="27" rx="2.5" ry="2" fill="#3D1A00"/>` +
  eyes +
  mouth +
  extra +
  `</svg>`;

const eOpen =
  `<circle cx="17" cy="19" r="3.5" fill="${D}"/><circle cx="31" cy="19" r="3.5" fill="${D}"/>` +
  `<circle cx="18.5" cy="18" r="1.2" fill="white"/><circle cx="32.5" cy="18" r="1.2" fill="white"/>`;
const eClosed =
  `<path d="M14 20 Q17 16.5 20 20" stroke="${D}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
  `<path d="M28 20 Q31 16.5 34 20" stroke="${D}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
const eHalf =
  `<ellipse cx="17" cy="20" rx="3.5" ry="2" fill="${D}"/><ellipse cx="31" cy="20" rx="3.5" ry="2" fill="${D}"/>` +
  `<ellipse cx="18.5" cy="20" rx="1" ry="0.7" fill="white"/><ellipse cx="32.5" cy="20" rx="1" ry="0.7" fill="white"/>`;
const eWide =
  `<circle cx="17" cy="19" r="4.5" fill="${D}"/><circle cx="31" cy="19" r="4.5" fill="${D}"/>` +
  `<circle cx="19" cy="17.5" r="1.5" fill="white"/><circle cx="33" cy="17.5" r="1.5" fill="white"/>`;
const eRight =
  `<circle cx="17" cy="19" r="3.5" fill="${D}"/><circle cx="31" cy="19" r="3.5" fill="${D}"/>` +
  `<circle cx="20" cy="18" r="1.2" fill="white"/><circle cx="34" cy="18" r="1.2" fill="white"/>`;
const eLeft =
  `<circle cx="17" cy="19" r="3.5" fill="${D}"/><circle cx="31" cy="19" r="3.5" fill="${D}"/>` +
  `<circle cx="15" cy="18" r="1.2" fill="white"/><circle cx="29" cy="18" r="1.2" fill="white"/>`;

const mSmile =
  `<path d="M17 29 Q24 34 31 29" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
  `<rect x="20" y="29" width="8" height="4.5" rx="1.5" fill="white"/>` +
  `<line x1="24" y1="29" x2="24" y2="33.5" stroke="#E0D0C0" stroke-width="1"/>`;
const mYawn =
  `<ellipse cx="24" cy="32" rx="6" ry="5.5" fill="${D}"/>` +
  `<ellipse cx="24" cy="31" rx="4.5" ry="3.5" fill="#CC4444"/>` +
  `<rect x="21" y="28" width="6" height="2" rx="0.5" fill="white"/>`;
const mFlat =
  `<path d="M18 30 L30 30" stroke="${D}" stroke-width="1.5" stroke-linecap="round"/>` +
  `<rect x="20" y="30" width="8" height="4" rx="1.5" fill="white"/>` +
  `<line x1="24" y1="30" x2="24" y2="34" stroke="#E0D0C0" stroke-width="1"/>`;
const mWorry =
  `<path d="M17 31 Q24 27.5 31 31" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
  `<rect x="20" y="27.5" width="8" height="4" rx="1.5" fill="white"/>` +
  `<line x1="24" y1="27.5" x2="24" y2="31.5" stroke="#E0D0C0" stroke-width="1"/>`;

const xZzz = `<text x="30" y="9" font-size="9" fill="#B8A8CC" font-family="Arial" font-weight="bold" opacity="0.9">zzz</text>`;
const xSearch =
  `<circle cx="36" cy="11" r="5" fill="none" stroke="${B}" stroke-width="2.5"/>` +
  `<line x1="39.5" y1="14.5" x2="43" y2="18" stroke="${B}" stroke-width="2.5" stroke-linecap="round"/>`;
const xSweat = `<ellipse cx="37" cy="15" rx="2" ry="3" fill="#7EC8F5" opacity="0.9"/>`;
const xPhone =
  `<rect x="32" y="26" width="9" height="14" rx="2" fill="#1A1A2E"/>` +
  `<rect x="33" y="28" width="7" height="9" fill="#4A9EFF" rx="0.5"/>` +
  `<circle cx="36.5" cy="38.5" r="1" fill="#555"/>`;
const xStar = `<text x="32" y="10" font-size="10" fill="#FFD700" opacity="0.9">✦</text>`;
const xWave = `<path d="M3 40 Q7 36 11 40 Q15 44 19 40" stroke="${B}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

const MASCOT_VARIANTS: Record<string, string[]> = {
  faceAbsent: [mk(eWide, mFlat, xSearch), mk(eRight, mWorry, xSweat), mk(eWide, mWorry)],
  eyesClosed: [mk(eClosed, mFlat, xZzz), mk(eHalf, mFlat, xZzz), mk(eClosed, mSmile, xZzz)],
  yawning: [mk(eHalf, mYawn), mk(eClosed, mYawn), mk(eHalf, mYawn, xStar)],
  lookingAway: [mk(eRight, mFlat), mk(eLeft, mFlat), mk(eRight, mWorry, xSweat)],
  headTurned: [mk(eLeft, mWorry), mk(eRight, mFlat, xPhone), mk(eLeft, mFlat, xSweat)],
  test: [mk(eOpen, mSmile, xWave), mk(eWide, mSmile), mk(eOpen, mSmile, xStar)],
};

function pickMascot(behavior: string): string {
  const variants = MASCOT_VARIANTS[behavior] ?? MASCOT_VARIANTS.test;
  return variants[Math.floor(Math.random() * variants.length)];
}

function buildNotificationHtml(behavior: string): string {
  const c = BEHAVIOR_CONTENT[behavior] ?? BEHAVIOR_CONTENT.test;
  const mascot = pickMascot(behavior);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 360px; height: 92px; overflow: hidden; background: transparent; }
    .toast {
      display: flex; align-items: center; gap: 6px;
      width: 360px; height: 92px;
      background: #fff; border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10);
      overflow: hidden; cursor: pointer; user-select: none;
      font-family: -apple-system, 'Segoe UI', sans-serif;
      animation: slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes slide-in {
      from { transform: translateX(110%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }
    .accent { width: 5px; align-self: stretch; background: ${c.accent}; flex-shrink: 0; }
    .mascot { flex-shrink: 0; padding: 0 2px 0 8px; display: flex; align-items: center; }
    .mascot svg { display: block; }
    .content { flex: 1; padding: 10px 0; }
    .app-label { font-size: 10px; font-weight: 700; color: #5dbae0; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 3px; }
    .title  { font-size: 13px; font-weight: 700; color: #1a202c; margin-bottom: 2px; }
    .body   { font-size: 11px; color: #718096; line-height: 1.35; }
    .close  { padding: 0 12px; font-size: 16px; color: #cbd5e0; cursor: pointer; flex-shrink: 0; align-self: stretch; display: flex; align-items: center; }
    .close:hover { color: #4a5568; }
  </style></head><body>
  <div class="toast" id="toast">
    <div class="accent"></div>
    <div class="mascot">${mascot}</div>
    <div class="content">
      <div class="app-label">Present.ly</div>
      <div class="title">${c.title}</div>
      <div class="body">${c.body}</div>
    </div>
    <div class="close" id="close">✕</div>
  </div>
  <script>
    document.getElementById('toast').addEventListener('click', function(e) {
      if (e.target.id !== 'close') window.electronNotify.restoreMain();
      window.close();
    });
    document.getElementById('close').addEventListener('click', function(e) {
      e.stopPropagation(); window.close();
    });
  </script>
  </body></html>`;
}

function showNotification(behavior: string): void {
  const { workAreaSize, bounds } = screen.getPrimaryDisplay();
  const W = 360;
  const H = 92;
  const PAD = 16;

  const win = new BrowserWindow({
    width: W,
    height: H,
    x: bounds.x + workAreaSize.width - W - PAD,
    y: bounds.y + workAreaSize.height - H - PAD,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/notify.js'),
      sandbox: false,
    },
  });

  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildNotificationHtml(behavior))}`
  );

  // Restore main window when toast body is clicked (via IPC from preload)
  ipcMain.once('notify-restore', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    if (!win.isDestroyed()) win.close();
  });
}

// ─── Main window ──────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow!.setIcon(icon);
    mainWindow!.show();
    // Unconditional test notification 5s after launch
    setTimeout(() => showNotification('test'), 5_000);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app
  .whenReady()
  .then(() => {
    electronApp.setAppUserModelId('com.electron');
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));

    ipcMain.on('ping', () => console.log('pong'));
    ipcMain.on('focus-alert', (_, { behavior }: { behavior: string }) =>
      showNotification(behavior)
    );

    const dbPath = process.env.FOCUS_DB_PATH || join(app.getPath('userData'), 'focus-monitor.db');
    focusService = new FocusService(dbPath);
    focusMonitor = new FocusMonitor({
      sampleIntervalMs: 5000,
      onClassifiedState: (event) => {
        focusService?.ingest(event);
      },
    });
    focusMonitor.start();

    ipcMain.removeHandler('preferences:save');
    ipcMain.handle('preferences:save', async (_, payload: unknown) => {
      if (!isValidPreferencesPayload(payload)) {
        throw new Error('Invalid preferences payload');
      }

      const safeUsername = sanitizeFileName(payload.username);
      if (!safeUsername) {
        throw new Error('Invalid username');
      }

      try {
        const preferencesDir = join(app.getPath('userData'), 'preferences');
        await mkdir(preferencesDir, { recursive: true });

        const filePath = join(preferencesDir, `${safeUsername}.json`);
        await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
        return { success: true, filePath };
      } catch (error) {
        console.error('Failed to save preferences file:', error);
        throw error;
      }
    });

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    console.error('Main process startup failed:', error);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  focusMonitor?.stop();
  focusMonitor = null;
  focusService?.shutdown();
  focusService = null;
});
