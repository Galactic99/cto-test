import { ipcMain } from 'electron';
import { AppSettings } from '../types/settings';
import { getSettings, setSettings } from './store/settings';
import * as blinkReminder from './reminders/blink';
import * as postureReminder from './reminders/posture';

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    const settings = getSettings();
    console.log('[IPC] Settings get requested:', settings);
    return settings;
  });

  ipcMain.handle(
    'settings:set',
    async (_event, partialSettings: Partial<AppSettings>): Promise<AppSettings> => {
      console.log('[IPC] Settings update requested:', partialSettings);
      const updatedSettings = setSettings(partialSettings);
      console.log('[IPC] Settings updated to:', updatedSettings);
      return updatedSettings;
    }
  );

  ipcMain.handle('reminder:test-blink', async (): Promise<void> => {
    console.log('[IPC] Test blink notification requested');
    blinkReminder.test();
  });

  ipcMain.handle('reminder:test-posture', async (): Promise<void> => {
    console.log('[IPC] Test posture notification requested');
    postureReminder.test();
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
