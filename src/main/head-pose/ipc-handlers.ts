import { ipcMain } from 'electron';
import { detectLandmarks } from './landmark-detector';

export function registerHeadPoseHandlers(): void {
  ipcMain.handle(
    'headpose:detect',
    async (_, payload: { data: Uint8Array; width: number; height: number }) => {
      return detectLandmarks(payload.data, payload.width, payload.height);
    },
  );
}
