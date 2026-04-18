import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      sendFocusAlert: (state: string, duration: number) => void;
    };
  }
}
