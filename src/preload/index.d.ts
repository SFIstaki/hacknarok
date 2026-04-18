import { ElectronAPI } from '@electron-toolkit/preload';

interface PreferencesPayload {
  username: string;
  userType: string;
  usageTypes: string[];
  alertSensitivity: number;
}

interface AppAPI {
  savePreferences: (payload: PreferencesPayload) => Promise<{ success: boolean; filePath: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
