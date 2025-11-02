import { ipcMain } from 'electron';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    console.log('[IPC] Settings get requested:', currentSettings);
    return { ...currentSettings };
  });

  ipcMain.handle(
    'settings:set',
    async (_event, partialSettings: Partial<AppSettings>): Promise<AppSettings> => {
      console.log('[IPC] Settings update requested:', partialSettings);
      currentSettings = { ...currentSettings, ...partialSettings };
      console.log('[IPC] Settings updated to:', currentSettings);
      return { ...currentSettings };
    }
  );

  ipcMain.handle('reminder:test-blink', async (): Promise<void> => {
    console.log('[IPC] Test blink notification requested');
  });

  ipcMain.handle('reminder:test-posture', async (): Promise<void> => {
    console.log('[IPC] Test posture notification requested');
  });

  ipcMain.handle('autostart:toggle', async (_event, enabled: boolean): Promise<void> => {
    console.log('[IPC] Autostart toggle requested:', enabled);
  });
}

export function cleanupIpcHandlers(): void {
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:set');
  ipcMain.removeHandler('reminder:test-blink');
  ipcMain.removeHandler('reminder:test-posture');
  ipcMain.removeHandler('autostart:toggle');
}
