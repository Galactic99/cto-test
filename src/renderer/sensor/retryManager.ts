export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryState {
  attempts: number;
  lastAttemptTime: number;
  nextRetryTime: number;
  isRetrying: boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

export class RetryManager {
  private config: RetryConfig;
  private state: RetryState;
  private retryTimer: number | null = null;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      attempts: 0,
      lastAttemptTime: 0,
      nextRetryTime: 0,
      isRetrying: false,
    };
  }

  canRetry(): boolean {
    return this.state.attempts < this.config.maxRetries;
  }

  getState(): RetryState {
    return { ...this.state };
  }

  reset(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.state = {
      attempts: 0,
      lastAttemptTime: 0,
      nextRetryTime: 0,
      isRetrying: false,
    };
  }

  calculateDelay(): number {
    if (this.state.attempts === 0) {
      return this.config.initialDelayMs;
    }

    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, this.state.attempts - 1),
      this.config.maxDelayMs
    );

    const jitter = Math.random() * 0.3 * delay;
    return Math.floor(delay + jitter);
  }

  async scheduleRetry(operation: () => Promise<void>): Promise<void> {
    if (!this.canRetry()) {
      console.error('[RetryManager] Max retries reached, cannot schedule retry');
      return;
    }

    if (this.state.isRetrying) {
      console.warn('[RetryManager] Retry already scheduled');
      return;
    }

    this.state.attempts++;
    this.state.isRetrying = true;

    const delay = this.calculateDelay();
    this.state.nextRetryTime = Date.now() + delay;

    console.log(
      `[RetryManager] Scheduling retry ${this.state.attempts}/${this.config.maxRetries} in ${delay}ms`
    );

    return new Promise((resolve) => {
      this.retryTimer = window.setTimeout(async () => {
        this.state.lastAttemptTime = Date.now();
        this.state.isRetrying = false;
        this.retryTimer = null;

        try {
          await operation();
          this.reset();
          resolve();
        } catch (error) {
          console.error('[RetryManager] Retry attempt failed:', error);
          resolve();
        }
      }, delay);
    });
  }
}
