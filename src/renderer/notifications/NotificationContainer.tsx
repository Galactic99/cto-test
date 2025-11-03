import { useEffect, useState } from 'react';
import { NotificationPayload, NotificationConfig, DEFAULT_NOTIFICATION_CONFIG } from '../../types/notification';
import { NotificationItem } from './NotificationItem';

declare global {
  interface Window {
    notificationsAPI: {
      onShowNotification: (callback: (payload: NotificationPayload) => void) => void;
      onDismissNotification: (callback: (id: string) => void) => void;
      onUpdateConfig: (callback: (config: NotificationConfig) => void) => void;
      notifyDismissed: (id: string) => void;
      notifyExpired: (id: string) => void;
    };
  }
}

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);

  useEffect(() => {
    window.notificationsAPI.onShowNotification((payload) => {
      setNotifications((prev) => {
        const filtered = prev.slice(-(config.maxVisible - 1));
        return [...filtered, payload];
      });
    });

    window.notificationsAPI.onDismissNotification((id) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    });

    window.notificationsAPI.onUpdateConfig((newConfig) => {
      setConfig(newConfig);
    });
  }, [config.maxVisible]);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    window.notificationsAPI.notifyDismissed(id);
  };

  const handleExpire = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    window.notificationsAPI.notifyExpired(id);
  };

  return (
    <div className={`notification-container ${config.position}`}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          position={config.position}
          onDismiss={handleDismiss}
          onExpire={handleExpire}
        />
      ))}
    </div>
  );
}
