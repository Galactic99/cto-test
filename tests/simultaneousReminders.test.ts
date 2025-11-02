import * as blinkReminder from '../src/main/reminders/blink';
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

describe('Simultaneous Blink and Posture Reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    blinkReminder.stop();
    postureReminder.stop();
  });

  afterEach(() => {
    jest.useRealTimers();
    blinkReminder.stop();
    postureReminder.stop();
  });

  it('should run both reminders independently with different intervals', () => {
    mockGetSettings.mockReturnValue({
      blink: { enabled: true, interval: 20 },
      posture: { enabled: true, interval: 30 },
      app: { startOnLogin: false },
      detection: {},
    });
    mockSubscribeToSettings.mockReturnValue(jest.fn());

    blinkReminder.start();
    postureReminder.start();

    jest.advanceTimersByTime(20 * 60 * 1000);
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Time to blink',
      body: 'Look away for 20 seconds to rest your eyes',
    });
    expect(mockShowNotification).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Check your posture',
      body: 'Sit upright, relax shoulders, feet flat',
    });
    expect(mockShowNotification).toHaveBeenCalledTimes(2);
  });

  it('should continue both reminders in subsequent cycles', () => {
    mockGetSettings.mockReturnValue({
      blink: { enabled: true, interval: 20 },
      posture: { enabled: true, interval: 30 },
      app: { startOnLogin: false },
      detection: {},
    });
    mockSubscribeToSettings.mockReturnValue(jest.fn());

    blinkReminder.start();
    postureReminder.start();

    jest.advanceTimersByTime(60 * 60 * 1000);

    const blinkCalls = mockShowNotification.mock.calls.filter(
      (call) => call[0].title === 'Time to blink'
    ).length;
    const postureCalls = mockShowNotification.mock.calls.filter(
      (call) => call[0].title === 'Check your posture'
    ).length;

    expect(blinkCalls).toBe(3);
    expect(postureCalls).toBe(2);
  });

  it('should allow stopping one reminder without affecting the other', () => {
    mockGetSettings.mockReturnValue({
      blink: { enabled: true, interval: 20 },
      posture: { enabled: true, interval: 30 },
      app: { startOnLogin: false },
      detection: {},
    });
    mockSubscribeToSettings.mockReturnValue(jest.fn());

    blinkReminder.start();
    postureReminder.start();

    jest.advanceTimersByTime(10 * 60 * 1000);
    blinkReminder.stop();

    jest.advanceTimersByTime(20 * 60 * 1000);

    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Check your posture',
      body: 'Sit upright, relax shoulders, feet flat',
    });
    expect(mockShowNotification).not.toHaveBeenCalledWith({
      title: 'Time to blink',
      body: 'Look away for 20 seconds to rest your eyes',
    });
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('should allow updating one reminder without affecting the other', () => {
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
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      })
      .mockReturnValue({
        blink: { enabled: true, interval: 10 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });

    mockSubscribeToSettings.mockImplementation((callback) => {
      settingsCallback = callback;
      return jest.fn();
    });

    blinkReminder.start();
    postureReminder.start();

    if (settingsCallback) {
      settingsCallback(
        {
          blink: { enabled: true, interval: 10 },
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
    }

    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Time to blink',
      body: 'Look away for 20 seconds to rest your eyes',
    });

    jest.advanceTimersByTime(20 * 60 * 1000);
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Check your posture',
      body: 'Sit upright, relax shoulders, feet flat',
    });

    expect(mockShowNotification).toHaveBeenCalledTimes(3);
  });

  it('should allow disabling one reminder while keeping the other active', () => {
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
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      })
      .mockReturnValue({
        blink: { enabled: false, interval: 20 },
        posture: { enabled: true, interval: 30 },
        app: { startOnLogin: false },
        detection: {},
      });

    mockSubscribeToSettings.mockImplementation((callback) => {
      settingsCallback = callback;
      return jest.fn();
    });

    blinkReminder.start();
    postureReminder.start();

    if (settingsCallback) {
      settingsCallback(
        {
          blink: { enabled: false, interval: 20 },
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
    }

    jest.advanceTimersByTime(30 * 60 * 1000);

    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Check your posture',
      body: 'Sit upright, relax shoulders, feet flat',
    });
    expect(mockShowNotification).not.toHaveBeenCalledWith({
      title: 'Time to blink',
      body: 'Look away for 20 seconds to rest your eyes',
    });
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('should support test commands for both reminders independently', () => {
    blinkReminder.test();
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Time to blink',
      body: 'Look away for 20 seconds to rest your eyes',
    });

    postureReminder.test();
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Check your posture',
      body: 'Sit upright, relax shoulders, feet flat',
    });

    expect(mockShowNotification).toHaveBeenCalledTimes(2);
  });
});
