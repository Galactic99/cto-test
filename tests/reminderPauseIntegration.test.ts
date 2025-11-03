import { ReminderManager } from '../src/main/reminders/ReminderManager';
import { pauseManager } from '../src/main/pauseManager';

jest.mock('../src/main/window', () => ({
  getSettingsWindow: jest.fn(() => null),
}));

describe('ReminderManager Pause Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    pauseManager.cleanup();
  });

  afterEach(() => {
    pauseManager.cleanup();
    jest.useRealTimers();
  });

  describe('Pause State Respect', () => {
    it('should suppress notifications when globally paused', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      pauseManager.pause(30);

      jest.advanceTimersByTime(1 * 60 * 1000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should fire notifications when not paused', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();

      jest.advanceTimersByTime(1 * 60 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should resume firing after pause expires', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      pauseManager.pause(2);

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should resume firing after manual resume', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      pauseManager.pause(30);

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      pauseManager.resume();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should suppress multiple scheduled notifications during pause', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      pauseManager.pause(5);

      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(1 * 60 * 1000);
      }

      expect(callback).not.toHaveBeenCalled();
    });

    it('should continue scheduling timers even when paused', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      pauseManager.pause(3);

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle pause and resume multiple times', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();

      pauseManager.pause(1);
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
      callback.mockClear();

      pauseManager.pause(1);
      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should work with different reminder intervals', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const manager1 = new ReminderManager(2, callback1);
      const manager2 = new ReminderManager(3, callback2);

      manager1.start();
      manager2.start();
      pauseManager.pause(5);

      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3 * 60 * 1000);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('State Transitions', () => {
    it('should handle pause activated mid-interval', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(5, callback);

      manager.start();

      jest.advanceTimersByTime(3 * 60 * 1000);
      pauseManager.pause(1);

      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle resume before timer fires', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(5, callback);

      manager.start();
      pauseManager.pause(10);

      jest.advanceTimersByTime(2 * 60 * 1000);
      pauseManager.resume();

      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
