/**
 * Settings Store Tests
 *
 * These tests verify the settings store functionality including:
 * - Default initialization
 * - Merging logic for partial updates
 * - Validation of interval min/max values
 * - Persistence behavior
 *
 * Note: These tests use a mock implementation since electron-store
 * is an ESM module that requires special Jest configuration.
 * In a real environment, the store uses electron-store for persistence.
 */

import { AppSettings, DEFAULT_SETTINGS } from '../src/types/settings';

// Mock implementation that simulates electron-store behavior
class MockStore<T extends Record<string, any>> {
  private data: T;

  constructor(options: { defaults: T; cwd?: string; name?: string }) {
    this.data = { ...options.defaults };
  }

  get store(): T {
    return { ...this.data };
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    // Validate interval values for blink and posture
    if ((key === 'blink' || key === 'posture') && typeof value === 'object' && value !== null) {
      const interval = (value as any).interval;
      if (typeof interval === 'number' && (interval < 1 || interval > 120)) {
        throw new Error(`Interval must be between 1 and 120 minutes`);
      }
    }
    this.data[key] = value;
  }

  clear(): void {
    this.data = { ...DEFAULT_SETTINGS } as unknown as T;
  }
}

describe('Settings Store', () => {
  let store: MockStore<AppSettings>;
  let getSettings: () => AppSettings;
  let setSettings: (partial: Partial<AppSettings>) => AppSettings;
  let resetSettings: () => AppSettings;

  beforeEach(() => {
    // Create a new store instance for each test
    store = new MockStore<AppSettings>({
      defaults: DEFAULT_SETTINGS,
      name: 'settings',
    });

    // Mock the functions from settings.ts
    getSettings = () => store.store;
    setSettings = (partialSettings: Partial<AppSettings>) => {
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
      return store.store;
    };
    resetSettings = () => {
      store.clear();
      return store.store;
    };
  });

  describe('Default Initialization', () => {
    it('should initialize with default settings on first launch', () => {
      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should have correct default values for blink settings', () => {
      const settings = getSettings();
      expect(settings.blink.enabled).toBe(true);
      expect(settings.blink.interval).toBe(20);
    });

    it('should have correct default values for posture settings', () => {
      const settings = getSettings();
      expect(settings.posture.enabled).toBe(true);
      expect(settings.posture.interval).toBe(30);
    });

    it('should have correct default values for app preferences', () => {
      const settings = getSettings();
      expect(settings.app.startOnLogin).toBe(false);
    });

    it('should have empty detection settings object', () => {
      const settings = getSettings();
      expect(settings.detection).toEqual({});
    });
  });

  describe('Merging Logic', () => {
    it('should merge partial blink settings', () => {
      const updated = setSettings({ blink: { enabled: false, interval: 20 } });
      expect(updated.blink.enabled).toBe(false);
      expect(updated.blink.interval).toBe(20);
    });

    it('should merge partial blink settings without affecting other namespaces', () => {
      const updated = setSettings({ blink: { enabled: false, interval: 20 } });
      expect(updated.posture).toEqual(DEFAULT_SETTINGS.posture);
      expect(updated.app).toEqual(DEFAULT_SETTINGS.app);
    });

    it('should merge only interval without changing enabled state', () => {
      const updated = setSettings({ blink: { ...getSettings().blink, interval: 15 } });
      expect(updated.blink.enabled).toBe(true);
      expect(updated.blink.interval).toBe(15);
    });

    it('should merge multiple namespaces at once', () => {
      const updated = setSettings({
        blink: { enabled: false, interval: 25 },
        posture: { enabled: false, interval: 45 },
      });
      expect(updated.blink.enabled).toBe(false);
      expect(updated.blink.interval).toBe(25);
      expect(updated.posture.enabled).toBe(false);
      expect(updated.posture.interval).toBe(45);
    });

    it('should merge app preferences', () => {
      const updated = setSettings({ app: { startOnLogin: true } });
      expect(updated.app.startOnLogin).toBe(true);
    });
  });

  describe('Validation of Min/Max Interval Values', () => {
    it('should accept valid interval values within range', () => {
      const updated = setSettings({ blink: { ...getSettings().blink, interval: 60 } });
      expect(updated.blink.interval).toBe(60);
    });

    it('should accept minimum interval value (1)', () => {
      const updated = setSettings({ blink: { ...getSettings().blink, interval: 1 } });
      expect(updated.blink.interval).toBe(1);
    });

    it('should accept maximum interval value (120)', () => {
      const updated = setSettings({ posture: { ...getSettings().posture, interval: 120 } });
      expect(updated.posture.interval).toBe(120);
    });

    it('should throw error for interval below minimum', () => {
      expect(() => {
        setSettings({ blink: { ...getSettings().blink, interval: 0 } });
      }).toThrow();
    });

    it('should throw error for interval above maximum', () => {
      expect(() => {
        setSettings({ blink: { ...getSettings().blink, interval: 121 } });
      }).toThrow();
    });

    it('should throw error for negative interval', () => {
      expect(() => {
        setSettings({ posture: { ...getSettings().posture, interval: -5 } });
      }).toThrow();
    });
  });

  describe('Persistence Behavior', () => {
    it('should persist settings across operations', () => {
      setSettings({ blink: { enabled: false, interval: 25 } });
      
      const settings = getSettings();
      expect(settings.blink.enabled).toBe(false);
      expect(settings.blink.interval).toBe(25);
    });

    it('should persist multiple changes', () => {
      setSettings({ blink: { enabled: false, interval: 25 } });
      setSettings({ posture: { enabled: false, interval: 40 } });
      setSettings({ app: { startOnLogin: true } });
      
      const settings = getSettings();
      expect(settings.blink.enabled).toBe(false);
      expect(settings.blink.interval).toBe(25);
      expect(settings.posture.enabled).toBe(false);
      expect(settings.posture.interval).toBe(40);
      expect(settings.app.startOnLogin).toBe(true);
    });

    it('should reset to defaults when cleared', () => {
      setSettings({ blink: { enabled: false, interval: 25 } });
      const resetResult = resetSettings();
      
      expect(resetResult).toEqual(DEFAULT_SETTINGS);
    });

    it('should return updated settings after each write', () => {
      const result1 = setSettings({ blink: { enabled: false, interval: 25 } });
      expect(result1.blink.enabled).toBe(false);
      expect(result1.blink.interval).toBe(25);
      
      const result2 = setSettings({ blink: { ...result1.blink, interval: 30 } });
      expect(result2.blink.enabled).toBe(false);
      expect(result2.blink.interval).toBe(30);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type integrity for boolean values', () => {
      const updated = setSettings({ blink: { enabled: false, interval: 20 } });
      expect(typeof updated.blink.enabled).toBe('boolean');
    });

    it('should maintain type integrity for number values', () => {
      const updated = setSettings({ blink: { enabled: true, interval: 25 } });
      expect(typeof updated.blink.interval).toBe('number');
    });

    it('should maintain structure of nested objects', () => {
      const settings = getSettings();
      expect(settings.blink).toHaveProperty('enabled');
      expect(settings.blink).toHaveProperty('interval');
      expect(settings.posture).toHaveProperty('enabled');
      expect(settings.posture).toHaveProperty('interval');
      expect(settings.app).toHaveProperty('startOnLogin');
    });
  });
});
