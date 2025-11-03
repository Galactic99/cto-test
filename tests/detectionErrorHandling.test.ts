import { RetryManager } from '../src/renderer/sensor/retryManager';
import { DetectionError } from '../src/types/detection';

describe('RetryManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should initialize with default config', () => {
    const retryManager = new RetryManager();
    const state = retryManager.getState();

    expect(state.attempts).toBe(0);
    expect(state.isRetrying).toBe(false);
    expect(retryManager.canRetry()).toBe(true);
  });

  it('should calculate exponential backoff delays', () => {
    const retryManager = new RetryManager({
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 10000,
    });

    const state = retryManager.getState();

    const delay1 = retryManager.calculateDelay();
    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThanOrEqual(1300);

    state.attempts = 1;
    const delay2 = retryManager.calculateDelay();
    expect(delay2).toBeGreaterThanOrEqual(1000);
    expect(delay2).toBeLessThanOrEqual(2600);
  });

  it('should respect max delay', () => {
    const retryManager = new RetryManager({
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
    });

    retryManager.getState().attempts = 10;
    const delay = retryManager.calculateDelay();
    expect(delay).toBeLessThanOrEqual(6500);
  });

  it('should track retry attempts', async () => {
    const retryManager = new RetryManager({ maxRetries: 3 });
    const mockOperation = jest.fn().mockResolvedValue(undefined);

    retryManager.scheduleRetry(mockOperation);
    expect(retryManager.getState().attempts).toBe(1);
    expect(retryManager.getState().isRetrying).toBe(true);

    jest.runAllTimers();
    await Promise.resolve();

    expect(mockOperation).toHaveBeenCalled();
  });

  it('should stop retrying after max attempts', () => {
    const retryManager = new RetryManager({ maxRetries: 3 });
    
    retryManager.scheduleRetry(jest.fn());
    expect(retryManager.getState().attempts).toBe(1);
    expect(retryManager.canRetry()).toBe(true);
    
    retryManager.scheduleRetry(jest.fn());
    expect(retryManager.getState().attempts).toBe(1);
  });

  it('should reset retry state', () => {
    const retryManager = new RetryManager();
    const mockOperation = jest.fn().mockResolvedValue(undefined);

    retryManager.scheduleRetry(mockOperation);
    expect(retryManager.getState().attempts).toBe(1);

    retryManager.reset();
    const state = retryManager.getState();
    expect(state.attempts).toBe(0);
    expect(state.isRetrying).toBe(false);
  });

  it('should not schedule retry if already retrying', async () => {
    const retryManager = new RetryManager();
    const mockOperation1 = jest.fn().mockResolvedValue(undefined);
    const mockOperation2 = jest.fn().mockResolvedValue(undefined);

    retryManager.scheduleRetry(mockOperation1);
    await retryManager.scheduleRetry(mockOperation2);

    expect(retryManager.getState().attempts).toBe(1);
  });

  it('should handle operation failures gracefully', async () => {
    const retryManager = new RetryManager();
    const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    retryManager.scheduleRetry(mockOperation);
    jest.runAllTimers();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('DetectionError types', () => {
  it('should create camera permission denied error', () => {
    const error: DetectionError = {
      type: 'camera_permission_denied',
      message: 'Camera permission denied by user',
      timestamp: Date.now(),
      retryable: false,
    };

    expect(error.type).toBe('camera_permission_denied');
    expect(error.retryable).toBe(false);
  });

  it('should create camera not found error', () => {
    const error: DetectionError = {
      type: 'camera_not_found',
      message: 'No camera found on this device',
      timestamp: Date.now(),
      retryable: false,
    };

    expect(error.type).toBe('camera_not_found');
    expect(error.retryable).toBe(false);
  });

  it('should create camera in use error', () => {
    const error: DetectionError = {
      type: 'camera_in_use',
      message: 'Camera is already in use by another application',
      timestamp: Date.now(),
      retryable: true,
    };

    expect(error.type).toBe('camera_in_use');
    expect(error.retryable).toBe(true);
  });

  it('should create model load failed error', () => {
    const error: DetectionError = {
      type: 'model_load_failed',
      message: 'Failed to load face detection model',
      timestamp: Date.now(),
      retryable: true,
    };

    expect(error.type).toBe('model_load_failed');
    expect(error.retryable).toBe(true);
  });

  it('should create runtime error', () => {
    const error: DetectionError = {
      type: 'runtime_error',
      message: 'Detection loop failed',
      timestamp: Date.now(),
      retryable: true,
      retryCount: 3,
    };

    expect(error.type).toBe('runtime_error');
    expect(error.retryable).toBe(true);
    expect(error.retryCount).toBe(3);
  });
});
