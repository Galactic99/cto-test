import type { NotificationsAPI } from '../../preload/notifications';

declare global {
  interface Window {
    notificationsAPI: NotificationsAPI;
  }
}

export {};
