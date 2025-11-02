import { ipcMain } from 'electron';
import { AppSettings } from '../types/settings';
import { getSettings, setSettings } from './store/settings';
import * as blinkReminder from './reminders/blink';
import * as postureReminder from './reminders/posture';
import * as autostart from './system/autostart';
import * as sensorWindow from './sensorWindow';
import { getSettingsWindow } from './window';

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
    autostart.setAutostart(enabled);
  });

  ipcMain.handle('sensor:enable-detection', async (): Promise<void> => {
    console.log('[IPC] Enable detection requested');
    try {
      await sensorWindow.enableDetection();
    } catch (error) {
      console.error('[IPC] Failed to enable detection:', error);
      throw error;
    }
  });

  ipcMain.handle('sensor:disable-detection', async (): Promise<void> => {
    console.log('[IPC] Disable detection requested');
    await sensorWindow.disableDetection();
  });

  ipcMain.handle('sensor:start-camera', async (): Promise<void> => {
    console.log('[IPC] Start camera requested');
    try {
      await sensorWindow.startCamera();
    } catch (error) {
      console.error('[IPC] Failed to start camera:', error);
      throw error;
    }
  });

  ipcMain.handle('sensor:stop-camera', async (): Promise<void> => {
    console.log('[IPC] Stop camera requested');
    await sensorWindow.stopCamera();
  });

  ipcMain.on('sensor:camera-error', (_event, error: string) => {
    console.error('[IPC] Camera error from sensor window:', error);
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('sensor:camera-error', error);
    }
  });

  ipcMain.on('sensor:camera-started', () => {
    console.log('[IPC] Camera started successfully');
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('sensor:camera-started');
    }
  });

  ipcMain.on('sensor:camera-stopped', () => {
    console.log('[IPC] Camera stopped successfully');
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('sensor:camera-stopped');
    }
  });
}

export function cleanupIpcHandlers(): void {
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:set');
  ipcMain.removeHandler('reminder:test-blink');
  ipcMain.removeHandler('reminder:test-posture');
  ipcMain.removeHandler('autostart:toggle');
  ipcMain.removeHandler('sensor:enable-detection');
  ipcMain.removeHandler('sensor:disable-detection');
  ipcMain.removeHandler('sensor:start-camera');
  ipcMain.removeHandler('sensor:stop-camera');
  ipcMain.removeAllListeners('sensor:camera-error');
  ipcMain.removeAllListeners('sensor:camera-started');
  ipcMain.removeAllListeners('sensor:camera-stopped');
}
