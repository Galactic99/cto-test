import * as postureReminder from '../src/main/reminders/posture';
import * as settingsStore from '../src/main/store/settings';
import * as notifications from '../src/main/system/notifications';
import { AppSettings } from '../src/types/settings';

jest.mock('../src/main/system/notifications');
jest.mock('../src/main/system/NotificationManager', () => ({
  getNotificationManager: jest.fn(() => ({
    show: jest.fn(),
    updateConfig: jest.fn(),
  })),
}));
jest.mock('../src/main/store/settings');

const mockShowNotification = notifications.showNotification as jest.MockedFunction<
  typeof notifications.showNotification
>;
const mockGetSettings = settingsStore.getSettings as jest.MockedFunction<
  typeof settingsStore.getSettings
>;
const mockSubscribeToSettings = settingsStore.subscribeToSettings as jest.MockedFunction<
  typeof settingsStore.subscribeToSettings
>;

const createMockSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  blink: { enabled: true, interval: 20 },
  posture: { enabled: true, interval: 30 },
  app: { startOnLogin: false },
  detection: { enabled: false },
  notifications: {
    position: 'top-right',
    timeout: 5000,
    soundEnabled: true,
  },
  ...overrides,
});

describe('Posture Reminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    postureReminder.stop();
  });

  afterEach(() => {
    jest.useRealTimers();
    postureReminder.stop();
  });

  describe('start', () => {
    it('should start posture reminders when enabled', () => {
      mockGetSettings.mockReturnValue(createMockSettings());
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Check your posture',
        body: 'Sit upright, relax shoulders, feet flat',
        type: 'posture',
      });
    });

    it('should not start when disabled', () => {
      mockGetSettings.mockReturnValue(createMockSettings({
        posture: { enabled: false, interval: 30 },
      }));

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should use configured interval', () => {
      mockGetSettings.mockReturnValue(createMockSettings({
        posture: { enabled: true, interval: 45 },
      }));
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();

      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to settings changes', () => {
      mockGetSettings.mockReturnValue(createMockSettings());
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      expect(mockSubscribeToSettings).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop posture reminders', () => {
      mockGetSettings.mockReturnValue(createMockSettings());
      const unsubscribe = jest.fn();
      mockSubscribeToSettings.mockReturnValue(unsubscribe);

      postureReminder.start();
      postureReminder.stop();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should call unsubscribe function', () => {
      mockGetSettings.mockReturnValue(createMockSettings());
      const unsubscribe = jest.fn();
      mockSubscribeToSettings.mockReturnValue(unsubscribe);

      postureReminder.start();
      postureReminder.stop();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update interval when settings change', () => {
      let settingsCallback: ((newSettings: AppSettings, oldSettings: AppSettings) => void) | null = null;

      mockGetSettings
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: { enabled: false },
        })
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 45 },
          app: { startOnLogin: false },
          detection: { enabled: false },
        });

      mockSubscribeToSettings.mockImplementation((callback) => {
        settingsCallback = callback;
        return jest.fn();
      });

      postureReminder.start();

      if (settingsCallback) {
        settingsCallback(
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: true, interval: 45 },
            app: { startOnLogin: false },
            detection: { enabled: false },
          },
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: true, interval: 30 },
            app: { startOnLogin: false },
            detection: { enabled: false },
          }
        );
      }

      jest.advanceTimersByTime(45 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should stop when disabled via update', () => {
      let settingsCallback: ((newSettings: AppSettings, oldSettings: AppSettings) => void) | null = null;

      mockGetSettings
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: { enabled: false },
        })
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: false, interval: 30 },
          app: { startOnLogin: false },
          detection: { enabled: false },
        });

      mockSubscribeToSettings.mockImplementation((callback) => {
        settingsCallback = callback;
        return jest.fn();
      });

      postureReminder.start();

      if (settingsCallback) {
        settingsCallback(
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: false, interval: 30 },
            app: { startOnLogin: false },
            detection: { enabled: false },
          },
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: true, interval: 30 },
            app: { startOnLogin: false },
            detection: { enabled: false },
          }
        );
      }

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should start when enabled via update', () => {
      let settingsCallback: ((newSettings: AppSettings, oldSettings: AppSettings) => void) | null = null;

      mockGetSettings
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: false, interval: 30 },
          app: { startOnLogin: false },
          detection: { enabled: false },
        })
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: { enabled: false },
        });

      mockSubscribeToSettings.mockImplementation((callback) => {
        settingsCallback = callback;
        return jest.fn();
      });

      postureReminder.start();

      if (settingsCallback) {
        settingsCallback(
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: true, interval: 30 },
            app: { startOnLogin: false },
            detection: { enabled: false },
          },
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: false, interval: 30 },
            app: { startOnLogin: false },
            detection: { enabled: false },
          }
        );
      }

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('test', () => {
    it('should show notification immediately', () => {
      postureReminder.test();

      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Check your posture',
        body: 'Sit upright, relax shoulders, feet flat',
        type: 'posture',
      });
    });
  });

  describe('Configuration', () => {
    it('should use default interval of 30 minutes', () => {
      mockGetSettings.mockReturnValue(createMockSettings());
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should show correct notification message', () => {
      postureReminder.test();

      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Check your posture',
        body: 'Sit upright, relax shoulders, feet flat',
        type: 'posture',
      });
    });
  });
});
