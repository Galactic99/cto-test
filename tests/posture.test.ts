import * as postureReminder from '../src/main/reminders/posture';
import * as settingsStore from '../src/main/store/settings';
import * as notifications from '../src/main/system/notifications';

jest.mock('../src/main/system/notifications');
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
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: 'Check your posture',
        body: 'Sit upright, relax shoulders, feet flat',
      });
    });

    it('should not start when disabled', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: false, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should use configured interval', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 45 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();

      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to settings changes', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      mockSubscribeToSettings.mockReturnValue(jest.fn());

      postureReminder.start();

      expect(mockSubscribeToSettings).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop posture reminders', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      const unsubscribe = jest.fn();
      mockSubscribeToSettings.mockReturnValue(unsubscribe);

      postureReminder.start();
      postureReminder.stop();

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should call unsubscribe function', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
      const unsubscribe = jest.fn();
      mockSubscribeToSettings.mockReturnValue(unsubscribe);

      postureReminder.start();
      postureReminder.stop();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update interval when settings change', () => {
      let settingsCallback: ((newSettings: any, oldSettings: any) => void) | null = null;

      mockGetSettings
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
        })
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 45 },
          app: { startOnLogin: false },
          detection: {},
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
            detection: {},
          },
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: true, interval: 30 },
            app: { startOnLogin: false },
            detection: {},
          }
        );
      }

      jest.advanceTimersByTime(45 * 60 * 1000);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    });

    it('should stop when disabled via update', () => {
      let settingsCallback: ((newSettings: any, oldSettings: any) => void) | null = null;

      mockGetSettings
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
        })
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: false, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
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
            detection: {},
          },
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: true, interval: 30 },
            app: { startOnLogin: false },
            detection: {},
          }
        );
      }

      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it('should start when enabled via update', () => {
      let settingsCallback: ((newSettings: any, oldSettings: any) => void) | null = null;

      mockGetSettings
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: false, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
        })
        .mockReturnValueOnce({
          blink: { enabled: true, interval: 20 },
          posture: { enabled: true, interval: 30 },
          app: { startOnLogin: false },
          detection: {},
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
            detection: {},
          },
          {
            blink: { enabled: true, interval: 20 },
            posture: { enabled: false, interval: 30 },
            app: { startOnLogin: false },
            detection: {},
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
      });
    });
  });

  describe('Configuration', () => {
    it('should use default interval of 30 minutes', () => {
      mockGetSettings.mockReturnValue({
        blink: { enabled: true, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });
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
      });
    });
  });
});
