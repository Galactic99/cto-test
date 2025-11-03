import { Notification } from 'electron';

export interface NotificationOptions {
  title: string;
  body: string;
}

export function showNotification(options: NotificationOptions): void {
  console.log('[Notification] Attempting to show notification:', {
    title: options.title,
    body: options.body,
    timestamp: new Date().toISOString(),
  });

  const notification = new Notification({
    title: options.title,
    body: options.body,
  });

  notification.on('show', () => {
    console.log('[Notification] Notification displayed successfully:', options.title);
  });

  notification.on('failed', (_event, error) => {
    console.error('[Notification] Notification failed to display:', error);
  });

  notification.on('click', () => {
    console.log('[Notification] Notification clicked:', options.title);
  });

  notification.on('close', () => {
    console.log('[Notification] Notification closed:', options.title);
  });

  notification.show();
  console.log('[Notification] notification.show() called successfully');
}
