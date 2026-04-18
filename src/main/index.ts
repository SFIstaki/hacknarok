import { app, shell, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';

let mainWindow: BrowserWindow | null = null;

// ─── Custom notification window ───────────────────────────────────────────────

const BEHAVIOR_CONTENT: Record<
  string,
  { icon: string; title: string; body: string; accent: string }
> = {
  faceAbsent: {
    icon: '🔍',
    title: 'Where did you go?',
    body: "We can't see you. Still at your desk?",
    accent: '#e53e3e',
  },
  eyesClosed: {
    icon: '😴',
    title: 'Feeling drowsy?',
    body: 'Your eyes have been closed for a while.',
    accent: '#805ad5',
  },
  yawning: {
    icon: '🥱',
    title: 'Big yawn!',
    body: 'Take a short break or grab some water.',
    accent: '#d69e2e',
  },
  lookingAway: {
    icon: '👀',
    title: 'Eyes drifting...',
    body: 'Your gaze wandered from the screen.',
    accent: '#ed8936',
  },
  headTurned: {
    icon: '↩️',
    title: 'Head turned away',
    body: 'You seem to be looking elsewhere.',
    accent: '#3182ce',
  },
  test: {
    icon: '🧪',
    title: 'Test notification',
    body: 'Presently notifications are working!',
    accent: '#5dbae0',
  },
};

function buildNotificationHtml(behavior: string): string {
  const c = BEHAVIOR_CONTENT[behavior] ?? BEHAVIOR_CONTENT.test;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 340px; height: 88px; overflow: hidden; background: transparent; }
    .toast {
      display: flex; align-items: center; gap: 10px;
      width: 340px; height: 88px;
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
    .icon   { font-size: 26px; padding: 0 4px 0 10px; flex-shrink: 0; }
    .content { flex: 1; padding: 12px 0; }
    .app-label { font-size: 10px; font-weight: 700; color: #5dbae0; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 3px; }
    .title  { font-size: 13px; font-weight: 700; color: #1a202c; margin-bottom: 2px; }
    .body   { font-size: 11px; color: #718096; line-height: 1.35; }
    .close  { padding: 0 14px; font-size: 16px; color: #cbd5e0; cursor: pointer; flex-shrink: 0; align-self: stretch; display: flex; align-items: center; }
    .close:hover { color: #4a5568; }
  </style></head><body>
  <div class="toast" id="toast">
    <div class="accent"></div>
    <div class="icon">${c.icon}</div>
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
  const W = 340;
  const H = 88;
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
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false },
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron');
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w));

  ipcMain.on('ping', () => console.log('pong'));
  ipcMain.on('focus-alert', (_, { behavior }: { behavior: string }) => showNotification(behavior));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
