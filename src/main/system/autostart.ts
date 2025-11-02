import { app } from 'electron';
import { getSettings, subscribeToSettings } from '../store/settings';

let unsubscribe: (() => void) | null = null;

/**
 * Set autostart (start on login) for the application
 * @param enabled Whether to enable or disable autostart
 */
export function setAutostart(enabled: boolean): void {
  console.log('[Autostart] Setting autostart to:', enabled);
  
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
    args: enabled ? ['--hidden'] : [],
  });
  
  console.log('[Autostart] Login item settings updated');
}

/**
 * Get the current autostart state
 * @returns Whether autostart is enabled
 */
export function getAutostart(): boolean {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
}

/**
 * Initialize the autostart module
 * Syncs the current settings with the system and sets up a subscription
 */
export function initialize(): void {
  console.log('[Autostart] Initializing...');
  
  const settings = getSettings();
  const currentAutostart = getAutostart();
  
  console.log('[Autostart] Current system autostart:', currentAutostart);
  console.log('[Autostart] Settings startOnLogin:', settings.app.startOnLogin);
  
  // Sync the current settings with the system
  if (settings.app.startOnLogin !== currentAutostart) {
    console.log('[Autostart] Syncing settings with system...');
    setAutostart(settings.app.startOnLogin);
  }
  
  // Subscribe to settings changes
  if (!unsubscribe) {
    unsubscribe = subscribeToSettings((newSettings, oldSettings) => {
      if (newSettings.app.startOnLogin !== oldSettings.app.startOnLogin) {
        console.log('[Autostart] Settings changed, updating autostart...');
        setAutostart(newSettings.app.startOnLogin);
      }
    });
  }
}

/**
 * Clean up the autostart module
 */
export function cleanup(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
