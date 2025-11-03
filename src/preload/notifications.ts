import { contextBridge, ipcRenderer } from 'electron';
import { NotificationPayload, NotificationConfig } from '../types/notification';

export interface NotificationsAPI {
  onShowNotification: (callback: (payload: NotificationPayload) => void) => void;
  onDismissNotification: (callback: (id: string) => void) => void;
  onUpdateConfig: (callback: (config: NotificationConfig) => void) => void;
  notifyDismissed: (id: string) => void;
  notifyExpired: (id: string) => void;
}

const notificationsAPI: NotificationsAPI = {
  onShowNotification: (callback: (payload: NotificationPayload) => void) => {
    ipcRenderer.on('notification:show', (_event, payload: NotificationPayload) => callback(payload));
  },
  onDismissNotification: (callback: (id: string) => void) => {
    ipcRenderer.on('notification:dismiss', (_event, id: string) => callback(id));
  },
  onUpdateConfig: (callback: (config: NotificationConfig) => void) => {
    ipcRenderer.on('notification:update-config', (_event, config: NotificationConfig) => callback(config));
  },
  notifyDismissed: (id: string) => {
    ipcRenderer.send('notification:dismissed', id);
  },
  notifyExpired: (id: string) => {
    ipcRenderer.send('notification:expired', id);
  },
};

contextBridge.exposeInMainWorld('notificationsAPI', notificationsAPI);
