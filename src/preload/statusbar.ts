import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('statusBarApi', {
  onUpdate: (cb: (state: string, labels: Record<string, string>, theme: string) => void): void => {
    ipcRenderer.on(
      'status:update',
      (_event, state: string, labels: Record<string, string>, theme: string) =>
        cb(state, labels, theme)
    );
  },
  restoreMain: (): void => {
    ipcRenderer.send('statusbar-restore');
  },
});
