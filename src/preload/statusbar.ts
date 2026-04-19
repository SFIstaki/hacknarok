import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('statusBarApi', {
  onUpdate: (cb: (state: string, labels: Record<string, string>) => void): void => {
    ipcRenderer.on('status:update', (_event, state: string, labels: Record<string, string>) =>
      cb(state, labels)
    );
  },
  restoreMain: (): void => {
    ipcRenderer.send('statusbar-restore');
  },
});
