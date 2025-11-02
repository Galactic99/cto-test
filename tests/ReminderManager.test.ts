import { ReminderManager } from '../src/main/reminders/ReminderManager';

describe('ReminderManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create instance with interval and callback', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(20, callback);

      expect(manager).toBeInstanceOf(ReminderManager);
      expect(manager.getIsRunning()).toBe(false);
    });
  });

  describe('Start and Stop', () => {
    it('should start scheduling reminders', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();

      expect(manager.getIsRunning()).toBe(true);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not start if already running', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      manager.start();

      jest.advanceTimersByTime(60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should stop scheduling reminders', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();
      manager.stop();

      expect(manager.getIsRunning()).toBe(false);

      jest.advanceTimersByTime(60 * 1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle stop when not running', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      expect(() => manager.stop()).not.toThrow();
      expect(manager.getIsRunning()).toBe(false);
    });
  });

  describe('Interval Scheduling', () => {
    it('should fire callback at correct interval', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(20, callback);

      manager.start();

      jest.advanceTimersByTime(20 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should fire callback multiple times', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(5, callback);

      manager.start();

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not fire callback before interval elapsed', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.start();

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should continue firing after first callback', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.start();

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Update Interval', () => {
    it('should update interval and restart if running', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.start();

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      manager.updateInterval(5);

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should update interval without starting if not running', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.updateInterval(5);

      expect(manager.getIsRunning()).toBe(false);
      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should use new interval for subsequent reminders', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.start();
      manager.updateInterval(3);

      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(3 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should reset timer when interval is updated', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.start();

      jest.advanceTimersByTime(8 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      manager.updateInterval(10);

      jest.advanceTimersByTime(8 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short intervals', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(1, callback);

      manager.start();

      jest.advanceTimersByTime(60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle very long intervals', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(120, callback);

      manager.start();

      jest.advanceTimersByTime(120 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle stop and restart', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(5, callback);

      manager.start();
      jest.advanceTimersByTime(3 * 60 * 1000);
      manager.stop();

      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();

      manager.start();
      jest.advanceTimersByTime(5 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should clear timer on stop', () => {
      const callback = jest.fn();
      const manager = new ReminderManager(10, callback);

      manager.start();
      jest.advanceTimersByTime(5 * 60 * 1000);
      manager.stop();

      const pendingTimers = jest.getTimerCount();
      expect(pendingTimers).toBe(0);
    });
  });
});
