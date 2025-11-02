/**
 * Autostart Tests
 *
 * These tests verify the autostart functionality including:
 * - Setting and getting autostart state
 * - Initializing with correct system state
 * - Syncing settings with system
 * - Proper cleanup
 */

import * as autostart from '../src/main/system/autostart';
import * as settingsStore from '../src/main/store/settings';
import { app } from 'electron';

jest.mock('electron', () => ({
  app: {
    setLoginItemSettings: jest.fn(),
    getLoginItemSettings: jest.fn(),
  },
}));

jest.mock('../src/main/store/settings');

const mockGetSettings = settingsStore.getSettings as jest.MockedFunction<
  typeof settingsStore.getSettings
>;
const mockSubscribeToSettings = settingsStore.subscribeToSettings as jest.MockedFunction<
  typeof settingsStore.subscribeToSettings
>;
const mockSetLoginItemSettings = app.setLoginItemSettings as jest.MockedFunction<
  typeof app.setLoginItemSettings
>;
const mockGetLoginItemSettings = app.getLoginItemSettings as jest.MockedFunction<
  typeof app.getLoginItemSettings
>;

describe('Autostart Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    autostart.cleanup();
  });

  afterEach(() => {
    autostart.cleanup();
  });

  describe('setAutostart', () => {
    it('should enable autostart with --hidden argument when enabled', () => {
      autostart.setAutostart(true);

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: ['--hidden'],
      });
    });

    it('should disable autostart with empty args when disabled', () => {
      autostart.setAutostart(false);

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: false,
        args: [],
      });
    });
  });

  describe('getAutostart', () => {
    it('should return true when autostart is enabled', () => {
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: true,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);

      const result = autostart.getAutostart();
      expect(result).toBe(true);
    });

    it('should return false when autostart is disabled', () => {
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);

      const result = autostart.getAutostart();
      expect(result).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should sync settings with system when they match', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: true },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: true,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      autostart.initialize();

      // Should not call setLoginItemSettings if already in sync
      expect(mockSetLoginItemSettings).not.toHaveBeenCalled();
      expect(mockSubscribeToSettings).toHaveBeenCalled();
    });

    it('should enable autostart when settings say true but system says false', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: true },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      autostart.initialize();

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: ['--hidden'],
      });
      expect(mockSubscribeToSettings).toHaveBeenCalled();
    });

    it('should disable autostart when settings say false but system says true', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: true,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      autostart.initialize();

      expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: false,
        args: [],
      });
      expect(mockSubscribeToSettings).toHaveBeenCalled();
    });

    it('should subscribe to settings changes', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);

      let settingsCallback: (newSettings: any, oldSettings: any) => void = () => {};
      mockSubscribeToSettings.mockImplementation((callback) => {
        settingsCallback = callback;
        return jest.fn();
      });

      autostart.initialize();

      // Simulate settings change
      settingsCallback(
        {
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: true },
          detection: {},
        },
        {
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
        }
      );

      // Should call setAutostart when app.startOnLogin changes
      expect(mockSetLoginItemSettings).toHaveBeenLastCalledWith({
        openAtLogin: true,
        openAsHidden: false,
        args: ['--hidden'],
      });
    });

    it('should not update autostart when other settings change', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);

      let settingsCallback: (newSettings: any, oldSettings: any) => void = () => {};
      mockSubscribeToSettings.mockImplementation((callback) => {
        settingsCallback = callback;
        return jest.fn();
      });

      autostart.initialize();
      jest.clearAllMocks();

      // Simulate settings change for blink interval
      settingsCallback(
        {
          blink: { enabled: true, interval: 25 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
        },
        {
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
        }
      );

      // Should not call setLoginItemSettings when app.startOnLogin doesn't change
      expect(mockSetLoginItemSettings).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from settings changes', () => {
      const mockUnsubscribe = jest.fn();
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);
      mockSubscribeToSettings.mockReturnValue(mockUnsubscribe);

      autostart.initialize();
      autostart.cleanup();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', () => {
      // Should not throw an error
      expect(() => autostart.cleanup()).not.toThrow();
    });

    it('should allow re-initialization after cleanup', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockGetLoginItemSettings.mockReturnValue({
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false,
        executableWillLaunchAtLogin: false,
        launchItems: [],
      } as any);
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      autostart.initialize();
      autostart.cleanup();
      jest.clearAllMocks();

      autostart.initialize();

      expect(mockSubscribeToSettings).toHaveBeenCalled();
    });
  });
});
