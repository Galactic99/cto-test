import { getNotificationManager } from './NotificationManager';
import { getSettings } from '../store/settings';

export interface NotificationOptions {
  title: string;
  body: string;
  type: 'blink' | 'posture';
  icon?: string;
  timeout?: number;
  soundEnabled?: boolean;
}

export function showNotification(options: NotificationOptions): string {
  console.log('[Notification] Attempting to show notification:', {
    title: options.title,
    body: options.body,
    type: options.type,
    timestamp: new Date().toISOString(),
  });

  const settings = getSettings();
  const manager = getNotificationManager();
  
  // Use provided soundEnabled, or fall back to settings
  const soundEnabled = options.soundEnabled !== undefined 
    ? options.soundEnabled 
    : settings.notifications.soundEnabled;
  
  // Use provided timeout, or fall back to settings
  const timeout = options.timeout || settings.notifications.timeout;

  const notificationId = manager.show(
    options.title,
    options.body,
    options.type,
    {
      icon: options.icon,
      timeout,
      soundEnabled,
    }
  );

  console.log('[Notification] Notification sent to overlay manager:', notificationId);
  return notificationId;
}
