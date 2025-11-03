import { BlinkPolicy, PosturePolicy } from '../src/main/detection/policy';
import { pauseManager } from '../src/main/pauseManager';

jest.mock('../src/main/system/notifications', () => ({
  showNotification: jest.fn(),
}));

jest.mock('../src/main/system/NotificationManager', () => ({
  getNotificationManager: jest.fn(() => ({
    show: jest.fn(),
    updateConfig: jest.fn(),
  })),
}));

jest.mock('../src/main/store/settings', () => ({
  getSettings: jest.fn(() => ({
    detection: {
      enabled: true,
      privacyConsentGiven: true,
      features: {
        blink: true,
        posture: true,
      },
    },
    notifications: {
      position: 'top-right',
      timeout: 5000,
      soundEnabled: true,
    },
  })),
}));

jest.mock('../src/main/window', () => ({
  getSettingsWindow: jest.fn(() => null),
}));

import { showNotification } from '../src/main/system/notifications';

describe('Detection Policy Pause Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    pauseManager.cleanup();
  });

  afterEach(() => {
    pauseManager.cleanup();
    jest.useRealTimers();
  });

  describe('BlinkPolicy Pause Integration', () => {
    it('should suppress notifications when globally paused', () => {
      const policy = new BlinkPolicy();
      pauseManager.pause(30);

      policy.evaluate(5, Date.now());

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, Date.now());

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should trigger notifications when not paused', () => {
      const policy = new BlinkPolicy();
      const startTime = Date.now();

      policy.evaluate(5, startTime);

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, startTime + 2 * 60 * 1000);

      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Low blink rate detected',
        })
      );
    });

    it('should trigger notification after pause ends', () => {
      const policy = new BlinkPolicy();
      pauseManager.pause(2);
      const startTime = Date.now();

      policy.evaluate(5, startTime);

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, startTime + 2 * 60 * 1000);

      expect(showNotification).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      pauseManager.resume();

      const newStartTime = Date.now();
      policy.evaluate(5, newStartTime);

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, newStartTime + 2 * 60 * 1000);

      expect(showNotification).toHaveBeenCalled();
    });

    it('should handle manual resume', () => {
      const policy = new BlinkPolicy();
      pauseManager.pause(30);
      const startTime = Date.now();

      policy.evaluate(5, startTime);

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, startTime + 2 * 60 * 1000);

      expect(showNotification).not.toHaveBeenCalled();

      pauseManager.resume();

      const newStartTime = Date.now();
      policy.evaluate(5, newStartTime);

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, newStartTime + 2 * 60 * 1000);

      expect(showNotification).toHaveBeenCalled();
    });

    it('should continue tracking state during pause', () => {
      const policy = new BlinkPolicy();
      pauseManager.pause(5);
      const startTime = Date.now();

      policy.evaluate(5, startTime);
      const state1 = policy.getState();
      expect(state1.isBlinkRateLow).toBe(true);

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(5, startTime + 2 * 60 * 1000);

      const state2 = policy.getState();
      expect(state2.isBlinkRateLow).toBe(true);
      expect(showNotification).not.toHaveBeenCalled();
    });
  });

  describe('PosturePolicy Pause Integration', () => {
    it('should suppress notifications when globally paused', () => {
      const policy = new PosturePolicy();
      pauseManager.pause(30);

      policy.evaluate(40, Date.now());

      jest.advanceTimersByTime(2 * 60 * 1000);
      policy.evaluate(40, Date.now());

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should trigger notifications when not paused', () => {
      const policy = new PosturePolicy();
      const startTime = Date.now();

      policy.evaluate(40, startTime);

      jest.advanceTimersByTime(1 * 60 * 1000);
      policy.evaluate(40, startTime + 1 * 60 * 1000);

      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Poor posture detected',
        })
      );
    });

    it('should trigger notification after pause ends', () => {
      const policy = new PosturePolicy();
      pauseManager.pause(2);
      const startTime = Date.now();

      policy.evaluate(40, startTime);

      jest.advanceTimersByTime(1 * 60 * 1000);
      policy.evaluate(40, startTime + 1 * 60 * 1000);

      expect(showNotification).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      pauseManager.resume();

      const newStartTime = Date.now();
      policy.evaluate(40, newStartTime);

      jest.advanceTimersByTime(1 * 60 * 1000);
      policy.evaluate(40, newStartTime + 1 * 60 * 1000);

      expect(showNotification).toHaveBeenCalled();
    });

    it('should handle manual resume', () => {
      const policy = new PosturePolicy();
      pauseManager.pause(30);
      const startTime = Date.now();

      policy.evaluate(40, startTime);

      jest.advanceTimersByTime(1 * 60 * 1000);
      policy.evaluate(40, startTime + 1 * 60 * 1000);

      expect(showNotification).not.toHaveBeenCalled();

      pauseManager.resume();

      const newStartTime = Date.now();
      policy.evaluate(40, newStartTime);

      jest.advanceTimersByTime(1 * 60 * 1000);
      policy.evaluate(40, newStartTime + 1 * 60 * 1000);

      expect(showNotification).toHaveBeenCalled();
    });

    it('should continue tracking state during pause', () => {
      const policy = new PosturePolicy();
      pauseManager.pause(5);
      const startTime = Date.now();

      policy.evaluate(40, startTime);
      const state1 = policy.getState();
      expect(state1.isPosturePoor).toBe(true);

      jest.advanceTimersByTime(1 * 60 * 1000);
      policy.evaluate(40, startTime + 1 * 60 * 1000);

      const state2 = policy.getState();
      expect(state2.isPosturePoor).toBe(true);
      expect(showNotification).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Policy Coordination', () => {
    it('should pause both blink and posture policies', () => {
      const blinkPolicy = new BlinkPolicy();
      const posturePolicy = new PosturePolicy();
      pauseManager.pause(30);

      const startTime = Date.now();

      blinkPolicy.evaluate(5, startTime);
      jest.advanceTimersByTime(2 * 60 * 1000);
      blinkPolicy.evaluate(5, startTime + 2 * 60 * 1000);

      posturePolicy.evaluate(40, startTime);
      jest.advanceTimersByTime(1 * 60 * 1000);
      posturePolicy.evaluate(40, startTime + 1 * 60 * 1000);

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should resume both policies together', () => {
      const blinkPolicy = new BlinkPolicy();
      const posturePolicy = new PosturePolicy();
      pauseManager.pause(30);

      let startTime = Date.now();

      blinkPolicy.evaluate(5, startTime);
      jest.advanceTimersByTime(2 * 60 * 1000);
      blinkPolicy.evaluate(5, startTime + 2 * 60 * 1000);

      posturePolicy.evaluate(40, startTime);
      jest.advanceTimersByTime(1 * 60 * 1000);
      posturePolicy.evaluate(40, startTime + 1 * 60 * 1000);

      expect(showNotification).not.toHaveBeenCalled();

      pauseManager.resume();

      startTime = Date.now();

      blinkPolicy.evaluate(5, startTime);
      jest.advanceTimersByTime(2 * 60 * 1000);
      blinkPolicy.evaluate(5, startTime + 2 * 60 * 1000);

      posturePolicy.evaluate(40, startTime);
      jest.advanceTimersByTime(1 * 60 * 1000);
      posturePolicy.evaluate(40, startTime + 1 * 60 * 1000);

      expect(showNotification).toHaveBeenCalledTimes(2);
    });
  });
});
