import { ReminderManager } from './ReminderManager';
import { showNotification } from '../system/notifications';
import { getSettings, subscribeToSettings } from '../store/settings';

let reminderManager: ReminderManager | null = null;
let unsubscribe: (() => void) | null = null;

function showPostureNotification(): void {
  showNotification({
    title: 'Check your posture',
    body: 'Sit upright, relax shoulders, feet flat',
  });
}

export function start(): void {
  const settings = getSettings();

  if (!settings.posture.enabled) {
    return;
  }

  if (reminderManager) {
    reminderManager.stop();
  }

  reminderManager = new ReminderManager(settings.posture.interval, showPostureNotification);
  reminderManager.start();

  if (!unsubscribe) {
    unsubscribe = subscribeToSettings((newSettings, oldSettings) => {
      if (
        newSettings.posture.enabled !== oldSettings.posture.enabled ||
        newSettings.posture.interval !== oldSettings.posture.interval
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

  if (!settings.posture.enabled) {
    if (reminderManager) {
      reminderManager.stop();
      reminderManager = null;
    }
    return;
  }

  if (!reminderManager) {
    start();
  } else {
    reminderManager.updateInterval(settings.posture.interval);
  }
}

export function test(): void {
  showPostureNotification();
}
