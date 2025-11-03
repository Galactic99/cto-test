import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { NotificationPayload, NotificationConfig, DEFAULT_NOTIFICATION_CONFIG, NotificationPosition } from '../../types/notification';

export class NotificationManager {
  private window: BrowserWindow | null = null;
  private config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG;
  private queue: NotificationPayload[] = [];
  private activeNotifications: Set<string> = new Set();
  private ipcHandlersSetup: boolean = false;

  constructor(config?: Partial<NotificationConfig>) {
    if (config) {
      this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
    }
  }

  private createWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      return;
    }

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;

    this.window = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/notifications.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    this.window.setIgnoreMouseEvents(false);
    this.window.setAlwaysOnTop(true, 'screen-saver', 1);
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    const notificationsUrl =
      process.env.NODE_ENV === 'development'
        ? `http://localhost:${process.env.PORT || 5173}/src/renderer/notifications/index.html`
        : `file://${path.join(__dirname, '../renderer/notifications.html')}`;

    this.window.loadURL(notificationsUrl);

    this.window.once('ready-to-show', () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.show();
        this.window.webContents.send('notification:update-config', this.config);
      }
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    if (!this.ipcHandlersSetup) {
      ipcMain.on('notification:dismissed', (_event, id: string) => {
        this.handleNotificationDismissed(id);
      });

      ipcMain.on('notification:expired', (_event, id: string) => {
        this.handleNotificationExpired(id);
      });
      
      this.ipcHandlersSetup = true;
    }
  }

  private cleanupIpcHandlers(): void {
    if (this.ipcHandlersSetup) {
      ipcMain.removeAllListeners('notification:dismissed');
      ipcMain.removeAllListeners('notification:expired');
      this.ipcHandlersSetup = false;
    }
  }

  private handleNotificationDismissed(id: string): void {
    this.activeNotifications.delete(id);
    console.log('[NotificationManager] Notification dismissed:', id);
    this.processQueue();
  }

  private handleNotificationExpired(id: string): void {
    this.activeNotifications.delete(id);
    console.log('[NotificationManager] Notification expired:', id);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    if (this.activeNotifications.size >= this.config.maxVisible) {
      return;
    }

    const notification = this.queue.shift();
    if (notification) {
      this.showNotificationInternal(notification);
    }
  }

  private showNotificationInternal(payload: NotificationPayload): void {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow();
      setTimeout(() => {
        this.showNotificationInternal(payload);
      }, 500);
      return;
    }

    this.activeNotifications.add(payload.id);
    this.window.webContents.send('notification:show', payload);
    console.log('[NotificationManager] Showing notification:', payload);
  }

  public show(
    title: string,
    body: string,
    type: 'blink' | 'posture',
    options?: { icon?: string; timeout?: number; soundEnabled?: boolean }
  ): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const payload: NotificationPayload = {
      id,
      title,
      body,
      type,
      icon: options?.icon,
      timeout: options?.timeout || this.config.defaultTimeout,
      position: this.config.position,
      soundEnabled: options?.soundEnabled,
    };

    if (this.activeNotifications.size < this.config.maxVisible) {
      this.showNotificationInternal(payload);
    } else {
      this.queue.push(payload);
    }

    return id;
  }

  public dismiss(id: string): void {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    this.window.webContents.send('notification:dismiss', id);
    this.activeNotifications.delete(id);
  }

  public updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('notification:update-config', this.config);
    }
  }

  public setPosition(position: NotificationPosition): void {
    this.updateConfig({ position });
  }

  public destroy(): void {
    this.cleanupIpcHandlers();
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
    this.queue = [];
    this.activeNotifications.clear();
  }
}

let notificationManager: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}

export function destroyNotificationManager(): void {
  if (notificationManager) {
    notificationManager.destroy();
    notificationManager = null;
  }
}
