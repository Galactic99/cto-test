import { PosturePolicy, createPosturePolicy } from '../src/main/detection/policy';
import * as notifications from '../src/main/system/notifications';
import * as settingsStore from '../src/main/store/settings';

jest.mock('../src/main/system/notifications');
jest.mock('../src/main/store/settings');

describe('PosturePolicy', () => {
  let policy: PosturePolicy;
  let mockShowNotification: jest.SpyInstance;
  let mockGetSettings: jest.SpyInstance;

  const defaultSettings = {
    detection: {
      enabled: true,
      privacyConsentGiven: true,
      features: {
        blink: true,
        posture: true,
      },
    },
    blink: { enabled: true, interval: 20 },
    posture: { enabled: true, interval: 30 },
    app: { startOnLogin: false },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockShowNotification = jest.spyOn(notifications, 'showNotification');
    mockGetSettings = jest.spyOn(settingsStore, 'getSettings');
    mockGetSettings.mockReturnValue(defaultSettings);
    policy = new PosturePolicy();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createPosturePolicy', () => {
    it('should create a policy with default config', () => {
      const p = createPosturePolicy();
      expect(p).toBeInstanceOf(PosturePolicy);
      const config = p.getConfig();
      expect(config.scoreThreshold).toBe(60);
      expect(config.cooldownMs).toBe(15 * 60 * 1000);
      expect(config.minRequiredDurationMs).toBe(30 * 1000);
      expect(config.maxRequiredDurationMs).toBe(60 * 1000);
      expect(config.improvementThreshold).toBe(15);
    });

    it('should create a policy with custom config', () => {
      const p = createPosturePolicy({
        scoreThreshold: 50,
        cooldownMs: 10 * 60 * 1000,
      });
      const config = p.getConfig();
      expect(config.scoreThreshold).toBe(50);
      expect(config.cooldownMs).toBe(10 * 60 * 1000);
    });
  });

  describe('global state checks', () => {
    it('should not trigger notification when detection is disabled', () => {
      mockGetSettings.mockReturnValue({
        ...defaultSettings,
        detection: { ...defaultSettings.detection, enabled: false },
      });

      const currentTime = Date.now();
      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 60000);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should not trigger notification when privacy consent not given', () => {
      mockGetSettings.mockReturnValue({
        ...defaultSettings,
        detection: { ...defaultSettings.detection, privacyConsentGiven: false },
      });

      const currentTime = Date.now();
      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 60000);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should not trigger notification when posture feature is disabled', () => {
      mockGetSettings.mockReturnValue({
        ...defaultSettings,
        detection: {
          ...defaultSettings.detection,
          features: { ...defaultSettings.detection.features, posture: false },
        },
      });

      const currentTime = Date.now();
      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 60000);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });
  });

  describe('threshold detection', () => {
    it('should not trigger notification when posture score is above threshold', () => {
      const currentTime = Date.now();
      policy.evaluate(70, currentTime);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should not trigger notification immediately when score drops below threshold', () => {
      const currentTime = Date.now();
      policy.evaluate(50, currentTime);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should trigger notification after minimum required duration below threshold', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      expect(mockShowNotification).not.toHaveBeenCalled();

      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Poor posture detected',
        body: expect.stringContaining('50/100'),
      });
    });

    it('should not trigger if score returns to normal before required duration', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 15000);
      policy.evaluate(70, currentTime + 20000);
      policy.evaluate(50, currentTime + 50000);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should track state correctly when score drops below threshold', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);

      const state = policy.getState();
      expect(state.isPosturePoor).toBe(true);
      expect(state.poorPostureStartTime).toBe(currentTime);
      expect(state.lastNotificationTime).toBeNull();
      expect(state.scoreAtNotification).toBeNull();
    });

    it('should reset poor posture state when score returns to normal', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      expect(policy.getState().isPosturePoor).toBe(true);

      policy.evaluate(70, currentTime + 15000);
      const state = policy.getState();
      expect(state.isPosturePoor).toBe(false);
      expect(state.poorPostureStartTime).toBeNull();
    });
  });

  describe('sustained duration window (30-60s)', () => {
    it('should trigger at minimum duration (30s)', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 29000);
      expect(mockShowNotification).not.toHaveBeenCalled();

      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should trigger within the duration window', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 45000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should trigger at maximum duration (60s)', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 60000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('cooldown enforcement', () => {
    it('should enforce 15-minute cooldown between notifications', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(50, currentTime + 30000 + 5 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(50, currentTime + 30000 + 15 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });

    it('should allow notification exactly at cooldown expiry', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(50, currentTime + 30000 + 15 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });

    it('should not reset cooldown if score returns to normal temporarily', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(70, currentTime + 60000);
      policy.evaluate(50, currentTime + 120000);
      policy.evaluate(50, currentTime + 150000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should track last notification time', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);

      const state = policy.getState();
      expect(state.lastNotificationTime).toBe(currentTime + 30000);
      expect(state.scoreAtNotification).toBe(50);
    });
  });

  describe('improvement threshold reset', () => {
    it('should reset cooldown when score improves by more than 15 points', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(70, currentTime + 60000);
      const state = policy.getState();
      expect(state.lastNotificationTime).toBeNull();
      expect(state.scoreAtNotification).toBeNull();

      policy.evaluate(50, currentTime + 90000);
      policy.evaluate(50, currentTime + 120000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });

    it('should not reset cooldown when improvement is exactly 15 points', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(65, currentTime + 60000);
      const state = policy.getState();
      expect(state.lastNotificationTime).not.toBeNull();
      expect(state.scoreAtNotification).not.toBeNull();
    });

    it('should reset cooldown when improvement is greater than 15 points', () => {
      const currentTime = Date.now();

      policy.evaluate(45, currentTime);
      policy.evaluate(45, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(80, currentTime + 60000);
      const state = policy.getState();
      expect(state.lastNotificationTime).toBeNull();
      expect(state.scoreAtNotification).toBeNull();
    });

    it('should handle multiple improvement cycles', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.evaluate(70, currentTime + 60000);

      policy.evaluate(40, currentTime + 120000);
      policy.evaluate(40, currentTime + 150000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);

      policy.evaluate(80, currentTime + 180000);

      policy.evaluate(45, currentTime + 240000);
      policy.evaluate(45, currentTime + 270000);
      expect(mockShowNotification).toHaveBeenCalledTimes(3);
    });
  });

  describe('notification content', () => {
    it('should include actual posture score in notification', () => {
      const currentTime = Date.now();

      policy.evaluate(55, currentTime);
      policy.evaluate(55, currentTime + 30000);

      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Poor posture detected',
        body: expect.stringContaining('55/100'),
      });
    });

    it('should round posture score in notification', () => {
      const currentTime = Date.now();

      policy.evaluate(52.7, currentTime);
      policy.evaluate(52.7, currentTime + 30000);

      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Poor posture detected',
        body: expect.stringContaining('53/100'),
      });
    });

    it('should include posture guidance in notification', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);

      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Poor posture detected',
        body: expect.stringContaining('Sit upright'),
      });
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.reset();

      const state = policy.getState();
      expect(state.isPosturePoor).toBe(false);
      expect(state.poorPostureStartTime).toBeNull();
      expect(state.lastNotificationTime).toBeNull();
      expect(state.scoreAtNotification).toBeNull();
    });

    it('should allow immediate notification after reset', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.reset();

      policy.evaluate(50, currentTime + 60000);
      policy.evaluate(50, currentTime + 90000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('continuous monitoring', () => {
    it('should handle continuous poor posture over extended period', () => {
      const startTime = Date.now();

      for (let minute = 0; minute <= 45; minute++) {
        const currentTime = startTime + minute * 60 * 1000;
        policy.evaluate(50, currentTime);
      }

      expect(mockShowNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle fluctuating scores around threshold', () => {
      const currentTime = Date.now();

      const scores = [70, 55, 62, 70, 58, 65, 70, 55];

      for (let i = 0; i < scores.length; i++) {
        policy.evaluate(scores[i], currentTime + i * 10000);
      }

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should handle sustained poor posture with brief improvements', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 15000);
      policy.evaluate(70, currentTime + 20000);
      policy.evaluate(50, currentTime + 25000);
      policy.evaluate(50, currentTime + 55000);

      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle exactly at threshold', () => {
      const currentTime = Date.now();

      policy.evaluate(60, currentTime);
      policy.evaluate(60, currentTime + 30000);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should handle zero posture score', () => {
      const currentTime = Date.now();

      policy.evaluate(0, currentTime);
      policy.evaluate(0, currentTime + 30000);

      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Poor posture detected',
        body: expect.stringContaining('0/100'),
      });
    });

    it('should handle perfect posture score', () => {
      const currentTime = Date.now();

      policy.evaluate(100, currentTime);
      policy.evaluate(100, currentTime + 30000);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should handle fractional posture scores', () => {
      const currentTime = Date.now();

      policy.evaluate(55.3, currentTime);
      policy.evaluate(55.7, currentTime + 30000);

      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('state persistence', () => {
    it('should maintain state across multiple evaluations', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      let state1 = policy.getState();

      policy.evaluate(50, currentTime + 15000);
      let state2 = policy.getState();

      expect(state2.isPosturePoor).toBe(true);
      expect(state2.poorPostureStartTime).toBe(state1.poorPostureStartTime);
    });

    it('should preserve notification time and score across evaluations', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);

      const notificationTime = policy.getState().lastNotificationTime;
      const notificationScore = policy.getState().scoreAtNotification;

      policy.evaluate(50, currentTime + 60000);

      expect(policy.getState().lastNotificationTime).toBe(notificationTime);
      expect(policy.getState().scoreAtNotification).toBe(notificationScore);
    });
  });

  describe('config updates', () => {
    it('should update cooldown config', () => {
      const currentTime = Date.now();

      policy.evaluate(50, currentTime);
      policy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      policy.updateConfig({ cooldownMs: 5 * 60 * 1000 });

      policy.evaluate(50, currentTime + 30000 + 5 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(2);
    });

    it('should preserve other config when updating one value', () => {
      policy.updateConfig({ scoreThreshold: 50 });

      const config = policy.getConfig();
      expect(config.scoreThreshold).toBe(50);
      expect(config.cooldownMs).toBe(15 * 60 * 1000);
      expect(config.minRequiredDurationMs).toBe(30 * 1000);
      expect(config.improvementThreshold).toBe(15);
    });

    it('should update threshold and apply immediately', () => {
      const currentTime = Date.now();

      policy.updateConfig({ scoreThreshold: 50 });

      policy.evaluate(55, currentTime);
      policy.evaluate(55, currentTime + 30000);

      expect(mockShowNotification).not.toHaveBeenCalled();

      policy.evaluate(45, currentTime + 60000);
      policy.evaluate(45, currentTime + 90000);

      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('improvement threshold configuration', () => {
    it('should respect custom improvement threshold', () => {
      const customPolicy = new PosturePolicy({ improvementThreshold: 20 });
      mockGetSettings.mockReturnValue(defaultSettings);

      const currentTime = Date.now();

      customPolicy.evaluate(50, currentTime);
      customPolicy.evaluate(50, currentTime + 30000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);

      customPolicy.evaluate(69, currentTime + 60000);
      expect(customPolicy.getState().lastNotificationTime).not.toBeNull();

      customPolicy.evaluate(71, currentTime + 90000);
      expect(customPolicy.getState().lastNotificationTime).toBeNull();
    });
  });
});
