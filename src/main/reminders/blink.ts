import { ReminderManager } from './ReminderManager';
import { showNotification } from '../system/notifications';
import { getSettings, subscribeToSettings } from '../store/settings';

let reminderManager: ReminderManager | null = null;
let unsubscribe: (() => void) | null = null;

function showBlinkNotification(): void {
  showNotification({
    title: 'Time to blink',
    body: 'Look away for 20 seconds to rest your eyes',
  });
}

export function start(): void {
  const settings = getSettings();

  if (!settings.blink.enabled) {
    return;
  }

  if (reminderManager) {
    reminderManager.stop();
  }

  reminderManager = new ReminderManager(settings.blink.interval, showBlinkNotification);
  reminderManager.start();

  if (!unsubscribe) {
    unsubscribe = subscribeToSettings((newSettings, oldSettings) => {
      if (
        newSettings.blink.enabled !== oldSettings.blink.enabled ||
        newSettings.blink.interval !== oldSettings.blink.interval
      ) {
        update();
      }
    });
  }
}

export function stop(): void {
  if (reminderManager) {
    reminderManager.stop();
    reminderManager = null;
  }

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export function update(): void {
  const settings = getSettings();

  if (!settings.blink.enabled) {
    if (reminderManager) {
      reminderManager.stop();
      reminderManager = null;
    }
    return;
  }

  if (!reminderManager) {
    start();
  } else {
    reminderManager.updateInterval(settings.blink.interval);
  }
}

export function test(): void {
  showBlinkNotification();
}
