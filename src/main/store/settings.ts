import Store from 'electron-store';
import {
  AppSettings,
  BlinkSettings,
  PostureSettings,
  AppPreferences,
  DetectionSettings,
  DEFAULT_SETTINGS,
} from '../../types/settings';

// Define the schema for electron-store with type validation
const schema = {
  blink: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
      },
      interval: {
        type: 'number',
        minimum: 1,
        maximum: 120, // max 2 hours
      },
    },
    required: ['enabled', 'interval'],
  },
  posture: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
      },
      interval: {
        type: 'number',
        minimum: 1,
        maximum: 120, // max 2 hours
      },
    },
    required: ['enabled', 'interval'],
  },
  app: {
    type: 'object',
    properties: {
      startOnLogin: {
        type: 'boolean',
      },
    },
    required: ['startOnLogin'],
  },
  detection: {
    type: 'object',
    properties: {},
  },
} as const;

// Create the store instance with defaults and schema
const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS,
  schema: schema as any, // electron-store uses JSON Schema which is compatible
  name: 'settings',
});

/**
 * Get all settings from the store
 */
export function getSettings(): AppSettings {
  return store.store;
}

/**
 * Update settings with partial updates and return the full updated settings
 */
export function setSettings(partialSettings: Partial<AppSettings>): AppSettings {
  // Deep merge the partial settings
  if (partialSettings.blink) {
    const currentBlink = store.get('blink');
    store.set('blink', { ...currentBlink, ...partialSettings.blink });
  }

  if (partialSettings.posture) {
    const currentPosture = store.get('posture');
    store.set('posture', { ...currentPosture, ...partialSettings.posture });
  }

  if (partialSettings.app) {
    const currentApp = store.get('app');
    store.set('app', { ...currentApp, ...partialSettings.app });
  }

  if (partialSettings.detection) {
    const currentDetection = store.get('detection');
    store.set('detection', { ...currentDetection, ...partialSettings.detection });
  }

  // Return the updated settings
  return store.store;
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): AppSettings {
  store.clear();
  return store.store;
}

/**
 * Subscribe to store changes
 * @param callback Function to call when settings change
 * @returns Unsubscribe function
 */
export function subscribeToSettings(
  callback: (newSettings: AppSettings, oldSettings: AppSettings) => void
): () => void {
  const unsubscribe = store.onDidChange('blink', (newValue, oldValue) => {
    callback(store.store, store.store);
  });

  const unsubscribePosture = store.onDidChange('posture', (newValue, oldValue) => {
    callback(store.store, store.store);
  });

  const unsubscribeApp = store.onDidChange('app', (newValue, oldValue) => {
    callback(store.store, store.store);
  });

  const unsubscribeDetection = store.onDidChange('detection', (newValue, oldValue) => {
    callback(store.store, store.store);
  });

  // Return combined unsubscribe function
  return () => {
    unsubscribe();
    unsubscribePosture();
    unsubscribeApp();
    unsubscribeDetection();
  };
}

/**
 * Get the store file path (useful for testing)
 */
export function getStorePath(): string {
  return store.path;
}

export default store;
