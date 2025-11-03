import { app, BrowserWindow } from 'electron';
import {
  createSettingsWindow,
  showSettingsWindow,
  destroySettingsWindow,
} from './window';
import { createSystemTray, destroySystemTray } from './tray';
import { registerIpcHandlers, cleanupIpcHandlers } from './ipc';
import * as blinkReminder from './reminders/blink';
import * as postureReminder from './reminders/posture';
import * as autostart from './system/autostart';
import * as sensorWindow from './sensorWindow';
import { pauseManager } from './pauseManager';
import * as idleDetection from './system/idleDetection';
import { getNotificationManager } from './system/NotificationManager';
import { getSettings, subscribeToSettings } from './store/settings';

// Set app user model ID for Windows notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('com.wellness.reminder');
}

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
    console.log('[Main] 🚀 App starting up...');
    
    // Register IPC handlers
    registerIpcHandlers();
    console.log('[Main] IPC handlers registered');

    // Initialize autostart module
    autostart.initialize();
    console.log('[Main] Autostart initialized');

    // Initialize notification manager with settings
    const initialSettings = getSettings();
    const notificationManager = getNotificationManager();
    notificationManager.updateConfig({
      position: initialSettings.notifications.position,
      defaultTimeout: initialSettings.notifications.timeout,
    });
    
    // Subscribe to notification settings changes
    subscribeToSettings((newSettings, oldSettings) => {
      if (
        newSettings.notifications.position !== oldSettings.notifications.position ||
        newSettings.notifications.timeout !== oldSettings.notifications.timeout
      ) {
        console.log('[Main] Notification settings changed, updating manager');
        notificationManager.updateConfig({
          position: newSettings.notifications.position,
          defaultTimeout: newSettings.notifications.timeout,
        });
      }
    });
    console.log('[Main] Notification manager initialized');

    // Create the settings window (hidden by default)
    createSettingsWindow();
    console.log('[Main] Settings window created');

    // Create system tray
    createSystemTray();
    console.log('[Main] System tray created');

    // Start blink reminders if enabled
    blinkReminder.start();
    console.log('[Main] Blink reminders started');

    // Start posture reminders if enabled
    postureReminder.start();
    console.log('[Main] Posture reminders started');

    // Initialize idle detection
    idleDetection.initializeIdleDetection();
    console.log('[Main] Idle detection initialized');

    // Check if --hidden flag is present
    const shouldStartHidden = process.argv.includes('--hidden');

    if (!shouldStartHidden) {
      // Show window on initial launch if not explicitly hidden
      showSettingsWindow();
      console.log('[Main] Settings window shown');
    } else {
      console.log('[Main] Starting hidden (--hidden flag present)');
    }
    
    console.log('[Main] ✅ App startup complete');

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
    blinkReminder.stop();
    postureReminder.stop();
    idleDetection.shutdownIdleDetection();
    pauseManager.cleanup();
    autostart.cleanup();
    sensorWindow.destroySensorWindow();
    
    // Cleanup notification manager
    import('./system/NotificationManager').then(({ destroyNotificationManager }) => {
      destroyNotificationManager();
    });
    
    cleanupIpcHandlers();
    destroySettingsWindow();
    destroySystemTray();
  });
}
