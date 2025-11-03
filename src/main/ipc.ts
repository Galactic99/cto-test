import { ipcMain } from 'electron';
import { AppSettings, DetectionSettings } from '../types/settings';
import { DetectionMetrics, DetectionStatus, DetectionError } from '../types/detection';
import { getSettings, setSettings } from './store/settings';
import * as blinkReminder from './reminders/blink';
import * as postureReminder from './reminders/posture';
import * as autostart from './system/autostart';
import * as sensorWindow from './sensorWindow';
import { getSettingsWindow } from './window';
import * as detectionState from './detectionState';
import { createBlinkPolicy, createPosturePolicy } from './detection/policy';
import { pauseManager, PauseState } from './pauseManager';

let blinkPolicy = createBlinkPolicy();
let posturePolicy = createPosturePolicy();

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

  ipcMain.on('sensor:detection-error', (_event, error: DetectionError) => {
    console.error('[IPC] Detection error from sensor window:', error);
    detectionState.setDetectionError(error);
    
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('sensor:detection-error', error);
    }
  });

  ipcMain.on('sensor:camera-started', () => {
    console.log('[IPC] Camera started successfully');
    detectionState.clearDetectionError();
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

  // Detection lifecycle handlers
  ipcMain.handle('detection:start', async (): Promise<void> => {
    console.log('[IPC] Detection start requested');
    try {
      await detectionState.startDetection();
      blinkPolicy.reset();
      posturePolicy.reset();
      console.log('[IPC] Blink and posture policies reset for new detection session');
    } catch (error) {
      console.error('[IPC] Failed to start detection:', error);
      throw error;
    }
  });

  ipcMain.handle('detection:stop', async (): Promise<void> => {
    console.log('[IPC] Detection stop requested');
    try {
      await detectionState.stopDetection();
    } catch (error) {
      console.error('[IPC] Failed to stop detection:', error);
      throw error;
    }
  });

  ipcMain.handle('detection:status', async (): Promise<DetectionStatus> => {
    console.log('[IPC] Detection status requested');
    return detectionState.getStatus();
  });

  ipcMain.handle('detection:metrics:get', async (): Promise<DetectionMetrics> => {
    console.log('[IPC] Detection metrics requested');
    return detectionState.getMetrics();
  });

  ipcMain.handle(
    'detection:settings:set',
    async (_event, settings: Partial<DetectionSettings>): Promise<DetectionStatus> => {
      console.log('[IPC] Detection settings update requested:', settings);
      return detectionState.updateSettings(settings);
    }
  );

  ipcMain.handle('detection:calibrate:posture', async (): Promise<void> => {
    console.log('[IPC] Posture calibration requested');
    
    if (!detectionState.isDetectionRunning()) {
      throw new Error('Cannot calibrate: detection is not running');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ipcMain.removeListener('sensor:calibration-result', calibrationHandler);
        reject(new Error('Calibration timeout'));
      }, 10000);

      const calibrationHandler = (_event: any, baseline: number) => {
        clearTimeout(timeout);
        ipcMain.removeListener('sensor:calibration-result', calibrationHandler);
        
        console.log('[IPC] Calibration result received:', baseline);
        
        const settings = getSettings();
        setSettings({
          detection: {
            ...settings.detection,
            postureBaselinePitch: baseline,
            postureCalibrationTimestamp: Date.now(),
          },
        });
        
        console.log('[IPC] Baseline saved to settings');
        
        const updatedSettings = getSettings();
        sensorWindow.sendToSensor('detection:configure', {
          features: detectionState.getStatus().features,
          fpsMode: detectionState.getStatus().fpsMode,
          postureBaselinePitch: updatedSettings.detection.postureBaselinePitch,
        });
        console.log('[IPC] Baseline applied to detection');
        
        resolve();
      };

      ipcMain.once('sensor:calibration-result', calibrationHandler);
      
      sensorWindow.sendToSensor('sensor:calibrate-posture');
    });
  });

  // Handler for metrics updates from sensor window
  ipcMain.on('sensor:metrics-update', (_event, metrics: DetectionMetrics) => {
    console.log('[IPC] Metrics update from sensor window:', metrics);
    detectionState.updateMetrics(metrics);
    
    // Evaluate blink policy if blink metrics are present
    if (metrics.blink && detectionState.isDetectionRunning()) {
      blinkPolicy.evaluate(metrics.blink.blinkRate, metrics.blink.timestamp);
    }
    
    // Evaluate posture policy if posture metrics are present
    if (metrics.posture && metrics.posture.postureScore !== undefined && detectionState.isDetectionRunning()) {
      posturePolicy.evaluate(metrics.posture.postureScore, metrics.posture.timestamp);
    }
    
    // Forward metrics to settings window if open
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('detection:metrics-updated', metrics);
    }
  });

  // Pause control handlers
  ipcMain.handle('pause:get-state', async (): Promise<PauseState> => {
    console.log('[IPC] Pause state requested');
    return pauseManager.getState();
  });

  ipcMain.handle('pause:toggle', async (_event, durationMinutes: number): Promise<void> => {
    console.log('[IPC] Pause toggle requested:', durationMinutes);
    const currentState = pauseManager.getState();
    if (currentState.isPaused) {
      pauseManager.resume();
    } else {
      pauseManager.pause(durationMinutes);
    }
  });

  ipcMain.handle('pause:resume', async (): Promise<void> => {
    console.log('[IPC] Manual resume requested');
    pauseManager.resume();
  });

  ipcMain.handle('detection:retry', async (): Promise<void> => {
    console.log('[IPC] Detection retry requested');
    detectionState.clearDetectionError();
    sensorWindow.sendToSensor('sensor:retry-detection');
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
  ipcMain.removeHandler('detection:start');
  ipcMain.removeHandler('detection:stop');
  ipcMain.removeHandler('detection:status');
  ipcMain.removeHandler('detection:metrics:get');
  ipcMain.removeHandler('detection:settings:set');
  ipcMain.removeHandler('detection:calibrate:posture');
  ipcMain.removeHandler('pause:get-state');
  ipcMain.removeHandler('pause:toggle');
  ipcMain.removeHandler('pause:resume');
  ipcMain.removeHandler('detection:retry');
  ipcMain.removeAllListeners('sensor:camera-error');
  ipcMain.removeAllListeners('sensor:detection-error');
  ipcMain.removeAllListeners('sensor:camera-started');
  ipcMain.removeAllListeners('sensor:camera-stopped');
  ipcMain.removeAllListeners('sensor:metrics-update');
}
