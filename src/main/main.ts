import { app, BrowserWindow } from 'electron';
import {
  createSettingsWindow,
  showSettingsWindow,
  destroySettingsWindow,
} from './window';
import { createSystemTray, destroySystemTray } from './tray';

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // Handle second instance attempts
  app.on('second-instance', () => {
    // Show the settings window when user tries to launch a second instance
    showSettingsWindow();
  });

  app.whenReady().then(() => {
    // Create the settings window (hidden by default)
    createSettingsWindow();

    // Create system tray
    createSystemTray();

    // Check if --hidden flag is present
    const shouldStartHidden = process.argv.includes('--hidden');

    if (!shouldStartHidden) {
      // Show window on initial launch if not explicitly hidden
      showSettingsWindow();
    }

    app.on('activate', () => {
      // On macOS, show window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createSettingsWindow();
      }
      showSettingsWindow();
    });
  });

  // Prevent window-all-closed from quitting the app
  // The app should stay in the tray
  app.on('window-all-closed', () => {
    // Keep app running in tray on all platforms
    // User must explicitly quit from tray menu
  });

  app.on('before-quit', () => {
    // Clean up resources before quitting
    destroySettingsWindow();
    destroySystemTray();
  });
}
