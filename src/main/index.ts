import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { FocusService } from './focus/service';
import { FocusMonitor } from './focus/monitor';
import { runOpenCVTest } from './opencv-test';
import { loadHeadPoseModels } from './head-pose/model-loader';

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

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app
  .whenReady()
  .then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron');

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // IPC test
    ipcMain.on('ping', () => console.log('pong'));

    runOpenCVTest().catch((err) => console.error('[OpenCV] Test failed:', err));
    loadHeadPoseModels().catch((err) => console.error('[ONNX] Model load failed:', err));

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
        const fileContent = JSON.stringify(payload, null, 2);

        await writeFile(filePath, fileContent, 'utf-8');

        return { success: true, filePath };
      } catch (error) {
        console.error('Failed to save preferences file:', error);
        throw error;
      }
    });

    createWindow();

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    console.error('Main process startup failed:', error);
    app.quit();
  });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  focusMonitor?.stop();
  focusMonitor = null;

  focusService?.shutdown();
  focusService = null;
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
