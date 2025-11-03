export type NotificationType = 'blink' | 'posture';

export type NotificationPosition = 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  icon?: string;
  timeout?: number; // milliseconds, default 5000
  position?: NotificationPosition; // default 'top-right'
}

export interface NotificationConfig {
  position: NotificationPosition;
  maxVisible: number; // max simultaneous notifications
  defaultTimeout: number; // milliseconds
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  position: 'top-right',
  maxVisible: 3,
  defaultTimeout: 5000,
};
