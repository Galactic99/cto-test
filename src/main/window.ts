import { BrowserWindow } from 'electron';
import * as path from 'path';

let settingsWindow: BrowserWindow | null = null;

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow) {
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    settingsWindow.webContents.openDevTools();
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  settingsWindow.on('close', (event) => {
    event.preventDefault();
    hideSettingsWindow();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function showSettingsWindow(): void {
  if (!settingsWindow) {
    createSettingsWindow();
  }
  settingsWindow?.show();
  settingsWindow?.focus();
}

export function hideSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
}

export function destroySettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.removeAllListeners('close');
    settingsWindow.destroy();
    settingsWindow = null;
  }
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}
