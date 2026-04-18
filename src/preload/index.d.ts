import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      sendFocusAlert: (behavior: string) => void;
    };
  }
}
