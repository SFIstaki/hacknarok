import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronNotify', {
  restoreMain: () => ipcRenderer.send('notify-restore'),
});
