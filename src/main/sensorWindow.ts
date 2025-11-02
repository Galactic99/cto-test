import { BrowserWindow } from 'electron';
import * as path from 'path';

let sensorWindow: BrowserWindow | null = null;

export function createSensorWindow(): BrowserWindow {
  if (sensorWindow) {
    return sensorWindow;
  }

  sensorWindow = new BrowserWindow({
    width: 640,
    height: 480,
    show: false,
    frame: false,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/sensor.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    sensorWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/sensor.html`);
  } else {
    sensorWindow.loadFile(path.join(__dirname, '../renderer/sensor.html'));
  }

  sensorWindow.on('closed', () => {
    sensorWindow = null;
  });

  return sensorWindow;
}

export function destroySensorWindow(): void {
  if (sensorWindow && !sensorWindow.isDestroyed()) {
    sensorWindow.destroy();
    sensorWindow = null;
  }
}

export function getSensorWindow(): BrowserWindow | null {
  return sensorWindow;
}

export function startCamera(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!sensorWindow || sensorWindow.isDestroyed()) {
      createSensorWindow();
    }

    if (sensorWindow) {
      sensorWindow.webContents.send('sensor:start-camera');
      resolve();
    } else {
      reject(new Error('Failed to create sensor window'));
    }
  });
}

export function stopCamera(): Promise<void> {
  return new Promise((resolve) => {
    if (sensorWindow && !sensorWindow.isDestroyed()) {
      sensorWindow.webContents.send('sensor:stop-camera');
    }
    resolve();
  });
}

export function enableDetection(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      createSensorWindow();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export function disableDetection(): Promise<void> {
  return stopCamera().then(() => {
    destroySensorWindow();
  });
}

export function sendToSensor(channel: string, ...args: any[]): void {
  if (sensorWindow && !sensorWindow.isDestroyed()) {
    sensorWindow.webContents.send(channel, ...args);
  } else {
    console.warn(`[SensorWindow] Cannot send to sensor: window not available (channel: ${channel})`);
  }
}
