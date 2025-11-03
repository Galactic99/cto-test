import { powerMonitor } from 'electron';
import { idleDetectionManager } from '../src/main/system/idleDetection';
import { pauseManager } from '../src/main/pauseManager';
import * as detectionState from '../src/main/detectionState';
import * as settingsStore from '../src/main/store/settings';

jest.mock('electron', () => ({
  powerMonitor: {
    getSystemIdleTime: jest.fn(),
  },
}));

jest.mock('../src/main/pauseManager', () => ({
  pauseManager: {
    pause: jest.fn(),
    resume: jest.fn(),
    getState: jest.fn(),
  },
}));

jest.mock('../src/main/detectionState', () => ({
  isDetectionRunning: jest.fn(),
  stopDetection: jest.fn(),
  startDetection: jest.fn(),
}));

jest.mock('../src/main/store/settings', () => ({
  getSettings: jest.fn(),
}));

describe('IdleDetectionManager', () => {
  const mockPowerMonitor = powerMonitor as jest.Mocked<typeof powerMonitor>;
  const mockPauseManager = pauseManager as jest.Mocked<typeof pauseManager>;
  const mockDetectionState = detectionState as jest.Mocked<typeof detectionState>;
  const mockSettingsStore = settingsStore as jest.Mocked<typeof settingsStore>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    mockSettingsStore.getSettings.mockReturnValue({
      blink: { enabled: true, interval: 20 },
      posture: { enabled: true, interval: 30 },
      app: { startOnLogin: false },
      detection: {
        enabled: false,
        idleDetection: {
          enabled: true,
          thresholdMinutes: 5,
        },
      },
    });

    mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
    mockDetectionState.isDetectionRunning.mockReturnValue(false);
    mockPauseManager.getState.mockReturnValue({
      isPaused: false,
      pausedUntil: null,
      source: null,
    });
  });

  afterEach(() => {
    idleDetectionManager.shutdown();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize when idle detection is enabled in settings', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      idleDetectionManager.initialize();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IdleDetection] Initializing idle detection'
      );

      consoleLogSpy.mockRestore();
    });

    it('should not initialize when idle detection is disabled in settings', () => {
      mockSettingsStore.getSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {
          enabled: false,
          idleDetection: {
            enabled: false,
            thresholdMinutes: 5,
          },
        },
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      idleDetectionManager.initialize();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IdleDetection] Idle detection is disabled in settings'
      );

      consoleLogSpy.mockRestore();
    });

    it('should not initialize twice', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      idleDetectionManager.initialize();
      idleDetectionManager.initialize();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IdleDetection] Already initialized'
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Idle Detection', () => {
    beforeEach(() => {
      idleDetectionManager.initialize();
      jest.clearAllMocks();
    });

    it('should detect when system becomes idle', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);

      jest.advanceTimersByTime(30000);

      expect(consoleLogSpy).toHaveBeenCalledWith('[IdleDetection] System became idle');
      expect(idleDetectionManager.isIdle()).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should pause notifications when system becomes idle', () => {
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);

      jest.advanceTimersByTime(30000);

      expect(mockPauseManager.pause).toHaveBeenCalledWith(20, 'idle');
    });

    it('should stop detection when running and system becomes idle', async () => {
      mockDetectionState.isDetectionRunning.mockReturnValue(true);
      mockDetectionState.stopDetection.mockResolvedValue();
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);

      jest.advanceTimersByTime(30000);

      await Promise.resolve();

      expect(mockDetectionState.stopDetection).toHaveBeenCalled();
    });

    it('should not stop detection when not running', () => {
      mockDetectionState.isDetectionRunning.mockReturnValue(false);
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);

      jest.advanceTimersByTime(30000);

      expect(mockDetectionState.stopDetection).not.toHaveBeenCalled();
    });

    it('should detect when system becomes active after being idle', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
      jest.advanceTimersByTime(30000);

      expect(consoleLogSpy).toHaveBeenCalledWith('[IdleDetection] System became active');
      expect(idleDetectionManager.isIdle()).toBe(false);

      consoleLogSpy.mockRestore();
    });

    it('should resume from idle-triggered pause when system becomes active', () => {
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);

      mockPauseManager.getState.mockReturnValue({
        isPaused: true,
        pausedUntil: Date.now() + 10000,
        source: 'idle',
      });

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
      jest.advanceTimersByTime(30000);

      expect(mockPauseManager.resume).toHaveBeenCalled();
    });

    it('should not resume from manual pause when system becomes active', () => {
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);

      mockPauseManager.getState.mockReturnValue({
        isPaused: true,
        pausedUntil: Date.now() + 10000,
        source: 'manual',
      });

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
      jest.advanceTimersByTime(30000);

      expect(mockPauseManager.resume).not.toHaveBeenCalled();
    });

    it('should restart detection when it was running before idle', async () => {
      mockDetectionState.isDetectionRunning.mockReturnValue(true);
      mockDetectionState.stopDetection.mockResolvedValue();
      mockDetectionState.startDetection.mockResolvedValue();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      mockDetectionState.isDetectionRunning.mockReturnValue(false);
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockDetectionState.startDetection).toHaveBeenCalled();
    });

    it('should not restart detection when it was not running before idle', async () => {
      mockDetectionState.isDetectionRunning.mockReturnValue(false);
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockDetectionState.startDetection).not.toHaveBeenCalled();
    });
  });

  describe('Idle Threshold Configuration', () => {
    it('should use configured idle threshold', () => {
      mockSettingsStore.getSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {
          enabled: false,
          idleDetection: {
            enabled: true,
            thresholdMinutes: 10,
          },
        },
      });

      idleDetectionManager.initialize();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(599);
      jest.advanceTimersByTime(30000);
      expect(idleDetectionManager.isIdle()).toBe(false);

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(600);
      jest.advanceTimersByTime(30000);
      expect(idleDetectionManager.isIdle()).toBe(true);
    });

    it('should use default threshold when not configured', () => {
      mockSettingsStore.getSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {
          enabled: false,
        },
      });

      idleDetectionManager.initialize();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(299);
      jest.advanceTimersByTime(30000);
      expect(idleDetectionManager.isIdle()).toBe(false);

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(300);
      jest.advanceTimersByTime(30000);
      expect(idleDetectionManager.isIdle()).toBe(true);
    });
  });

  describe('Settings Updates', () => {
    it('should initialize when settings are updated to enable idle detection', () => {
      mockSettingsStore.getSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {
          enabled: false,
          idleDetection: {
            enabled: false,
            thresholdMinutes: 5,
          },
        },
      });

      idleDetectionManager.updateSettings();

      mockSettingsStore.getSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {
          enabled: false,
          idleDetection: {
            enabled: true,
            thresholdMinutes: 5,
          },
        },
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      idleDetectionManager.updateSettings();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IdleDetection] Initializing idle detection'
      );

      consoleLogSpy.mockRestore();
    });

    it('should shutdown when settings are updated to disable idle detection', () => {
      idleDetectionManager.initialize();

      mockSettingsStore.getSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {
          enabled: false,
          idleDetection: {
            enabled: false,
            thresholdMinutes: 5,
          },
        },
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      idleDetectionManager.updateSettings();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[IdleDetection] Shutting down idle detection'
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Shutdown', () => {
    it('should stop polling and reset state on shutdown', () => {
      idleDetectionManager.initialize();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);
      expect(idleDetectionManager.isIdle()).toBe(true);

      idleDetectionManager.shutdown();

      const state = idleDetectionManager.getState();
      expect(state.isIdle).toBe(false);
      expect(state.detectionWasRunning).toBe(false);
    });

    it('should not throw when shutdown called multiple times', () => {
      idleDetectionManager.initialize();

      expect(() => {
        idleDetectionManager.shutdown();
        idleDetectionManager.shutdown();
      }).not.toThrow();
    });

    it('should stop polling timer on shutdown', () => {
      idleDetectionManager.initialize();

      const timersBefore = jest.getTimerCount();
      expect(timersBefore).toBeGreaterThan(0);

      idleDetectionManager.shutdown();

      const timersAfter = jest.getTimerCount();
      expect(timersAfter).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      idleDetectionManager.initialize();
    });

    it('should handle errors when stopping detection', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDetectionState.isDetectionRunning.mockReturnValue(true);
      mockDetectionState.stopDetection.mockRejectedValue(new Error('Stop failed'));
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);

      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[IdleDetection] Error stopping detection:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors when starting detection', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockDetectionState.isDetectionRunning.mockReturnValue(true);
      mockDetectionState.stopDetection.mockResolvedValue();
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      mockDetectionState.startDetection.mockRejectedValue(new Error('Start failed'));
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[IdleDetection] Error restarting detection:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle errors in powerMonitor.getSystemIdleTime', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPowerMonitor.getSystemIdleTime.mockImplementation(() => {
        throw new Error('PowerMonitor error');
      });

      jest.advanceTimersByTime(30000);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[IdleDetection] Error checking idle state:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      idleDetectionManager.initialize();
    });

    it('should return current idle state', () => {
      expect(idleDetectionManager.isIdle()).toBe(false);

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);

      expect(idleDetectionManager.isIdle()).toBe(true);
    });

    it('should return full state object', () => {
      mockDetectionState.isDetectionRunning.mockReturnValue(true);
      mockDetectionState.stopDetection.mockResolvedValue();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(301);
      jest.advanceTimersByTime(30000);

      const state = idleDetectionManager.getState();
      expect(state).toEqual({
        isIdle: true,
        detectionWasRunning: true,
      });
    });

    it('should not allow external mutation of state', () => {
      const state1 = idleDetectionManager.getState();
      state1.isIdle = true;

      const state2 = idleDetectionManager.getState();
      expect(state2.isIdle).toBe(false);
    });
  });

  describe('Polling Behavior', () => {
    it('should poll every 30 seconds', () => {
      idleDetectionManager.initialize();

      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);

      jest.advanceTimersByTime(30000);
      expect(mockPowerMonitor.getSystemIdleTime).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(30000);
      expect(mockPowerMonitor.getSystemIdleTime).toHaveBeenCalledTimes(3);

      jest.advanceTimersByTime(30000);
      expect(mockPowerMonitor.getSystemIdleTime).toHaveBeenCalledTimes(4);
    });

    it('should check idle state immediately on initialization', () => {
      mockPowerMonitor.getSystemIdleTime.mockReturnValue(0);

      idleDetectionManager.initialize();

      expect(mockPowerMonitor.getSystemIdleTime).toHaveBeenCalledTimes(1);
    });
  });
});
