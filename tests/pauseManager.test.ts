import { pauseManager, PauseState } from '../src/main/pauseManager';

jest.mock('../src/main/window', () => ({
  getSettingsWindow: jest.fn(() => null),
}));

describe('PauseManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    pauseManager.cleanup();
  });

  afterEach(() => {
    pauseManager.cleanup();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in unpaused state', () => {
      const state = pauseManager.getState();
      expect(state.isPaused).toBe(false);
      expect(state.pausedUntil).toBe(null);
    });
  });

  describe('Pause Functionality', () => {
    it('should pause for specified duration', () => {
      const startTime = Date.now();
      pauseManager.pause(30);

      const state = pauseManager.getState();
      expect(state.isPaused).toBe(true);
      expect(state.pausedUntil).toBeGreaterThan(startTime);
      expect(state.pausedUntil).toBeLessThanOrEqual(startTime + 30 * 60 * 1000 + 10);
    });

    it('should automatically resume after duration', () => {
      pauseManager.pause(30);

      expect(pauseManager.getState().isPaused).toBe(true);

      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(pauseManager.getState().isPaused).toBe(false);
      expect(pauseManager.getState().pausedUntil).toBe(null);
    });

    it('should extend pause when pausing while already paused', () => {
      pauseManager.pause(10);
      const firstState = pauseManager.getState();
      expect(firstState.isPaused).toBe(true);

      jest.advanceTimersByTime(5 * 60 * 1000);

      pauseManager.pause(30);
      const secondState = pauseManager.getState();
      expect(secondState.isPaused).toBe(true);
      expect(secondState.pausedUntil).toBeGreaterThan(firstState.pausedUntil!);
    });

    it('should handle pause for different durations', () => {
      const durations = [5, 15, 30, 60];

      durations.forEach((duration) => {
        pauseManager.cleanup();
        const startTime = Date.now();
        pauseManager.pause(duration);

        const state = pauseManager.getState();
        expect(state.isPaused).toBe(true);
        expect(state.pausedUntil).toBeGreaterThanOrEqual(startTime + duration * 60 * 1000);
      });
    });
  });

  describe('Resume Functionality', () => {
    it('should manually resume from pause', () => {
      pauseManager.pause(30);
      expect(pauseManager.getState().isPaused).toBe(true);

      pauseManager.resume();
      const state = pauseManager.getState();
      expect(state.isPaused).toBe(false);
      expect(state.pausedUntil).toBe(null);
    });

    it('should handle resume when not paused', () => {
      expect(() => pauseManager.resume()).not.toThrow();
      expect(pauseManager.getState().isPaused).toBe(false);
    });

    it('should cancel automatic resume timer on manual resume', () => {
      pauseManager.pause(30);
      pauseManager.resume();

      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(pauseManager.getState().isPaused).toBe(false);
    });

    it('should clear pause state on resume', () => {
      pauseManager.pause(15);
      const pausedState = pauseManager.getState();
      expect(pausedState.isPaused).toBe(true);
      expect(pausedState.pausedUntil).not.toBe(null);

      pauseManager.resume();
      const resumedState = pauseManager.getState();
      expect(resumedState.isPaused).toBe(false);
      expect(resumedState.pausedUntil).toBe(null);
    });
  });

  describe('State Management', () => {
    it('should return current state', () => {
      const initialState = pauseManager.getState();
      expect(initialState).toEqual({
        isPaused: false,
        pausedUntil: null,
      });

      pauseManager.pause(30);
      const pausedState = pauseManager.getState();
      expect(pausedState.isPaused).toBe(true);
      expect(pausedState.pausedUntil).not.toBe(null);
    });

    it('should provide immutable state', () => {
      pauseManager.pause(30);
      const state1 = pauseManager.getState();
      const state2 = pauseManager.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe('Listeners', () => {
    it('should notify listeners on pause', () => {
      const listener = jest.fn();
      pauseManager.subscribe(listener);

      pauseManager.pause(30);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        isPaused: true,
        pausedUntil: expect.any(Number),
      });
    });

    it('should notify listeners on resume', () => {
      const listener = jest.fn();
      pauseManager.subscribe(listener);

      pauseManager.pause(30);
      listener.mockClear();

      pauseManager.resume();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        isPaused: false,
        pausedUntil: null,
      });
    });

    it('should notify listeners on automatic resume', () => {
      const listener = jest.fn();
      pauseManager.subscribe(listener);

      pauseManager.pause(30);
      listener.mockClear();

      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        isPaused: false,
        pausedUntil: null,
      });
    });

    it('should allow multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      pauseManager.subscribe(listener1);
      pauseManager.subscribe(listener2);

      pauseManager.pause(30);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe listener', () => {
      const listener = jest.fn();
      const unsubscribe = pauseManager.subscribe(listener);

      pauseManager.pause(30);
      expect(listener).toHaveBeenCalledTimes(1);

      listener.mockClear();
      unsubscribe();

      pauseManager.resume();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clear timers on cleanup', () => {
      pauseManager.pause(30);
      expect(pauseManager.getState().isPaused).toBe(true);

      pauseManager.cleanup();

      expect(pauseManager.getState().isPaused).toBe(false);
      expect(pauseManager.getState().pausedUntil).toBe(null);
    });

    it('should clear listeners on cleanup', () => {
      const listener = jest.fn();
      pauseManager.subscribe(listener);

      pauseManager.cleanup();
      pauseManager.pause(30);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not throw when cleanup called multiple times', () => {
      expect(() => {
        pauseManager.cleanup();
        pauseManager.cleanup();
      }).not.toThrow();
    });

    it('should cancel pending auto-resume on cleanup', () => {
      pauseManager.pause(30);
      pauseManager.cleanup();

      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(pauseManager.getState().isPaused).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition from unpaused to paused', () => {
      expect(pauseManager.getState().isPaused).toBe(false);

      pauseManager.pause(30);

      expect(pauseManager.getState().isPaused).toBe(true);
    });

    it('should transition from paused to unpaused via resume', () => {
      pauseManager.pause(30);
      expect(pauseManager.getState().isPaused).toBe(true);

      pauseManager.resume();

      expect(pauseManager.getState().isPaused).toBe(false);
    });

    it('should transition from paused to unpaused via timeout', () => {
      pauseManager.pause(1);
      expect(pauseManager.getState().isPaused).toBe(true);

      jest.advanceTimersByTime(1 * 60 * 1000);

      expect(pauseManager.getState().isPaused).toBe(false);
    });

    it('should remain paused if resumed and paused again quickly', () => {
      pauseManager.pause(30);
      pauseManager.resume();
      pauseManager.pause(30);

      expect(pauseManager.getState().isPaused).toBe(true);
    });
  });

  describe('Timer Management', () => {
    it('should clear previous timer when pausing while already paused', () => {
      pauseManager.pause(10);

      const timerCountBefore = jest.getTimerCount();

      pauseManager.pause(30);

      const timerCountAfter = jest.getTimerCount();

      expect(timerCountAfter).toBe(timerCountBefore);
    });

    it('should have no pending timers after manual resume', () => {
      pauseManager.pause(30);
      pauseManager.resume();

      const pendingTimers = jest.getTimerCount();

      expect(pendingTimers).toBe(0);
    });

    it('should have no pending timers after cleanup', () => {
      pauseManager.pause(30);
      pauseManager.cleanup();

      const pendingTimers = jest.getTimerCount();

      expect(pendingTimers).toBe(0);
    });
  });
});
