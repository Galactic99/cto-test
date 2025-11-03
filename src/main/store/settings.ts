import ElectronStore, { Schema } from 'electron-store';
import {
  AppSettings,
  BlinkSettings,
  PostureSettings,
  AppPreferences,
  DetectionSettings,
  DEFAULT_SETTINGS,
} from '../../types/settings';

// Type for Store instance with proper methods
type Store = ElectronStore<AppSettings> & {
  get<K extends keyof AppSettings>(key: K): AppSettings[K];
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  clear(): void;
  onDidChange<K extends keyof AppSettings>(
    key: K,
    callback: (newValue: AppSettings[K] | undefined, oldValue: AppSettings[K] | undefined) => void
  ): () => void;
  readonly store: AppSettings;
  readonly path: string;
};

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
    properties: {
      idleDetection: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
          },
          thresholdMinutes: {
            type: 'number',
            minimum: 1,
            maximum: 60,
          },
        },
      },
    },
  },
} as const;

// Create the store instance with defaults and schema
const store = new ElectronStore<AppSettings>({
  defaults: DEFAULT_SETTINGS,
  schema: schema as Schema<AppSettings>,
  name: 'settings',
}) as Store;

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
  return getSettings();
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): AppSettings {
  store.clear();
  return getSettings();
}

/**
 * Subscribe to store changes
 * @param callback Function to call when settings change
 * @returns Unsubscribe function
 */
export function subscribeToSettings(
  callback: (newSettings: AppSettings, oldSettings: AppSettings) => void
): () => void {
  const unsubscribe = store.onDidChange('blink', (_newValue: BlinkSettings | undefined, oldValue: BlinkSettings | undefined) => {
    const currentSettings = getSettings();
    const oldSettings = { ...currentSettings, blink: oldValue || currentSettings.blink };
    callback(currentSettings, oldSettings);
  });

  const unsubscribePosture = store.onDidChange('posture', (_newValue: PostureSettings | undefined, oldValue: PostureSettings | undefined) => {
    const currentSettings = getSettings();
    const oldSettings = { ...currentSettings, posture: oldValue || currentSettings.posture };
    callback(currentSettings, oldSettings);
  });

  const unsubscribeApp = store.onDidChange('app', (_newValue: AppPreferences | undefined, oldValue: AppPreferences | undefined) => {
    const currentSettings = getSettings();
    const oldSettings = { ...currentSettings, app: oldValue || currentSettings.app };
    callback(currentSettings, oldSettings);
  });

  const unsubscribeDetection = store.onDidChange('detection', (_newValue: DetectionSettings | undefined, oldValue: DetectionSettings | undefined) => {
    const currentSettings = getSettings();
    const oldSettings = { ...currentSettings, detection: oldValue || currentSettings.detection };
    callback(currentSettings, oldSettings);
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
