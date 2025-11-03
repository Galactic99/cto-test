import { BlinkPolicy, createBlinkPolicy } from '../src/main/detection/policy';
import * as notifications from '../src/main/system/notifications';

jest.mock('../src/main/system/notifications');

describe('BlinkPolicy', () => {
  let policy: BlinkPolicy;
  let mockShowNotification: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockShowNotification = jest.spyOn(notifications, 'showNotification');
    policy = new BlinkPolicy();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createBlinkPolicy', () => {
    it('should create a policy with default config', () => {
      const p = createBlinkPolicy();
      expect(p).toBeInstanceOf(BlinkPolicy);
      const config = p.getConfig();
      expect(config.thresholdBpm).toBe(9);
      expect(config.cooldownMs).toBe(10 * 60 * 1000);
      expect(config.requiredDurationMs).toBe(60 * 1000);
    });

    it('should create a policy with custom config', () => {
      const p = createBlinkPolicy({
        thresholdBpm: 12,
        cooldownMs: 5 * 60 * 1000,
      });
      const config = p.getConfig();
      expect(config.thresholdBpm).toBe(12);
      expect(config.cooldownMs).toBe(5 * 60 * 1000);
    });
  });

  describe('threshold detection', () => {
    it('should not trigger notification when blink rate is above threshold', () => {
      const currentTime = Date.now();
      policy.evaluate(10, currentTime); // Above threshold of 9
      
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should not trigger notification immediately when rate drops below threshold', () => {
      const currentTime = Date.now();
      policy.evaluate(8, currentTime); // Below threshold
      
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should trigger notification after required duration below threshold', () => {
      const currentTime = Date.now();
      
      // Start with low rate
      policy.evaluate(8, currentTime);
      expect(mockShowNotification).not.toHaveBeenCalled();
      
      // Still low after required duration (1 minute)
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Low blink rate detected',
        body: expect.stringContaining('8 times per minute'),
      });
    });

    it('should not trigger if rate returns to normal before required duration', () => {
      const currentTime = Date.now();
      
      // Start with low rate
      policy.evaluate(8, currentTime);
      
      // Rate returns to normal after 30 seconds (before required 60s)
      policy.evaluate(10, currentTime + 30000);
      
      // Rate drops again
      policy.evaluate(8, currentTime + 90000);
      
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should track state correctly when rate drops below threshold', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      
      const state = policy.getState();
      expect(state.isBlinkRateLow).toBe(true);
      expect(state.lowRateStartTime).toBe(currentTime);
      expect(state.lastNotificationTime).toBeNull();
    });

    it('should reset low rate state when rate returns to normal', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      expect(policy.getState().isBlinkRateLow).toBe(true);
      
      policy.evaluate(10, currentTime + 30000);
      const state = policy.getState();
      expect(state.isBlinkRateLow).toBe(false);
      expect(state.lowRateStartTime).toBeNull();
    });
  });

  describe('cooldown enforcement', () => {
    it('should enforce 10-minute cooldown between notifications', () => {
      const currentTime = Date.now();
      
      // First notification
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      // Still low, but within cooldown (5 minutes later)
      policy.evaluate(8, currentTime + 60000 + 5 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1); // No new notification
      
      // After cooldown (10 minutes later)
      policy.evaluate(8, currentTime + 60000 + 10 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2); // New notification
    });

    it('should allow notification exactly at cooldown expiry', () => {
      const currentTime = Date.now();
      
      // First notification
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      // Exactly at cooldown expiry
      policy.evaluate(8, currentTime + 60000 + 10 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });

    it('should not reset cooldown if rate returns to normal temporarily', () => {
      const currentTime = Date.now();
      
      // First notification
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      // Rate returns to normal
      policy.evaluate(10, currentTime + 120000);
      
      // Rate drops again within cooldown
      policy.evaluate(8, currentTime + 180000);
      policy.evaluate(8, currentTime + 240000); // Required duration met
      expect(mockShowNotification).toHaveBeenCalledTimes(1); // Still in cooldown
    });

    it('should track last notification time', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      
      const state = policy.getState();
      expect(state.lastNotificationTime).toBe(currentTime + 60000);
    });
  });

  describe('required duration', () => {
    it('should require exactly 1 minute below threshold by default', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      
      // Just before 1 minute
      policy.evaluate(8, currentTime + 59000);
      expect(mockShowNotification).not.toHaveBeenCalled();
      
      // At 1 minute
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should support custom required duration', () => {
      const customPolicy = new BlinkPolicy({
        requiredDurationMs: 2 * 60 * 1000, // 2 minutes
      });
      const currentTime = Date.now();
      
      customPolicy.evaluate(8, currentTime);
      
      // After 1 minute
      customPolicy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).not.toHaveBeenCalled();
      
      // After 2 minutes
      customPolicy.evaluate(8, currentTime + 120000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should restart duration counter if rate returns to normal', () => {
      const currentTime = Date.now();
      
      // Low for 30 seconds
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 30000);
      
      // Returns to normal
      policy.evaluate(10, currentTime + 40000);
      
      // Low again
      policy.evaluate(8, currentTime + 50000);
      
      // 60 seconds after second drop (70 seconds after start)
      policy.evaluate(8, currentTime + 110000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      const state = policy.getState();
      expect(state.lastNotificationTime).toBe(currentTime + 110000);
    });
  });

  describe('threshold configuration', () => {
    it('should respect custom threshold', () => {
      const customPolicy = new BlinkPolicy({ thresholdBpm: 12 });
      const currentTime = Date.now();
      
      // 11 bpm is below custom threshold of 12
      customPolicy.evaluate(11, currentTime);
      customPolicy.evaluate(11, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should update threshold via updateConfig', () => {
      const currentTime = Date.now();
      
      policy.updateConfig({ thresholdBpm: 7 });
      
      // 8 bpm is now above threshold of 7
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });
  });

  describe('notification content', () => {
    it('should include actual blink rate in notification', () => {
      const currentTime = Date.now();
      
      policy.evaluate(6.5, currentTime);
      policy.evaluate(6.5, currentTime + 60000);
      
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Low blink rate detected',
        body: expect.stringContaining('7 times per minute'), // Rounded
      });
    });

    it('should round blink rate in notification', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8.7, currentTime);
      policy.evaluate(8.7, currentTime + 60000);
      
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Low blink rate detected',
        body: expect.stringContaining('9 times per minute'),
      });
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      policy.reset();
      
      const state = policy.getState();
      expect(state.isBlinkRateLow).toBe(false);
      expect(state.lowRateStartTime).toBeNull();
      expect(state.lastNotificationTime).toBeNull();
    });

    it('should allow immediate notification after reset', () => {
      const currentTime = Date.now();
      
      // First notification
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      // Reset
      policy.reset();
      
      // Should allow new notification immediately (no cooldown)
      policy.evaluate(8, currentTime + 120000);
      policy.evaluate(8, currentTime + 180000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('continuous monitoring', () => {
    it('should handle continuous low blink rate over extended period', () => {
      const startTime = Date.now();
      
      // Simulate continuous monitoring over 30 minutes
      for (let minute = 0; minute <= 30; minute++) {
        const currentTime = startTime + minute * 60 * 1000;
        policy.evaluate(8, currentTime);
      }
      
      // Should trigger at 1, 11, and 21 minutes (10-min cooldown)
      expect(mockShowNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle fluctuating rates around threshold', () => {
      const currentTime = Date.now();
      
      // Fluctuating pattern - rates that go up and down around threshold
      const rates = [10, 8, 9, 10, 8, 9, 10, 8]; // Mix above/below threshold
      
      for (let i = 0; i < rates.length; i++) {
        policy.evaluate(rates[i], currentTime + i * 20000);
      }
      
      // Should not trigger because rate doesn't stay low for full minute
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should handle sustained low rate with brief spikes', () => {
      const currentTime = Date.now();
      
      // Low for 30 seconds
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 30000);
      
      // Brief spike
      policy.evaluate(10, currentTime + 40000);
      
      // Low again for 60+ seconds
      policy.evaluate(8, currentTime + 50000);
      policy.evaluate(8, currentTime + 110000);
      
      // Should trigger only after continuous 60s low period
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle exactly at threshold', () => {
      const currentTime = Date.now();
      
      // Exactly 9 bpm (at threshold, not below)
      policy.evaluate(9, currentTime);
      policy.evaluate(9, currentTime + 60000);
      
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should handle zero blink rate', () => {
      const currentTime = Date.now();
      
      policy.evaluate(0, currentTime);
      policy.evaluate(0, currentTime + 60000);
      
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Low blink rate detected',
        body: expect.stringContaining('0 times per minute'),
      });
    });

    it('should handle very high blink rate', () => {
      const currentTime = Date.now();
      
      policy.evaluate(100, currentTime);
      policy.evaluate(100, currentTime + 60000);
      
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should handle fractional blink rates', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8.3, currentTime);
      policy.evaluate(8.7, currentTime + 60000);
      
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('state persistence', () => {
    it('should maintain state across multiple evaluations', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      let state1 = policy.getState();
      
      policy.evaluate(8, currentTime + 30000);
      let state2 = policy.getState();
      
      expect(state2.isBlinkRateLow).toBe(true);
      expect(state2.lowRateStartTime).toBe(state1.lowRateStartTime);
    });

    it('should preserve notification time across evaluations', () => {
      const currentTime = Date.now();
      
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      
      const notificationTime = policy.getState().lastNotificationTime;
      
      policy.evaluate(8, currentTime + 120000);
      
      expect(policy.getState().lastNotificationTime).toBe(notificationTime);
    });
  });

  describe('config updates', () => {
    it('should update cooldown config', () => {
      const currentTime = Date.now();
      
      // First notification with default 10-min cooldown
      policy.evaluate(8, currentTime);
      policy.evaluate(8, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      
      // Update to 5-min cooldown
      policy.updateConfig({ cooldownMs: 5 * 60 * 1000 });
      
      // Should trigger after 5 minutes now
      policy.evaluate(8, currentTime + 60000 + 5 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });

    it('should preserve other config when updating one value', () => {
      policy.updateConfig({ thresholdBpm: 7 });
      
      const config = policy.getConfig();
      expect(config.thresholdBpm).toBe(7);
      expect(config.cooldownMs).toBe(10 * 60 * 1000); // Unchanged
      expect(config.requiredDurationMs).toBe(60 * 1000); // Unchanged
    });
  });
});
