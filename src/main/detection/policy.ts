import { showNotification } from '../system/notifications';

export interface BlinkPolicyConfig {
  thresholdBpm: number;
  cooldownMs: number;
  requiredDurationMs: number;
}

interface BlinkPolicyState {
  isBlinkRateLow: boolean;
  lowRateStartTime: number | null;
  lastNotificationTime: number | null;
}

const DEFAULT_CONFIG: BlinkPolicyConfig = {
  thresholdBpm: 9,
  cooldownMs: 10 * 60 * 1000, // 10 minutes
  requiredDurationMs: 60 * 1000, // 1 minute
};

export class BlinkPolicy {
  private config: BlinkPolicyConfig;
  private state: BlinkPolicyState;

  constructor(config: Partial<BlinkPolicyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isBlinkRateLow: false,
      lowRateStartTime: null,
      lastNotificationTime: null,
    };
  }

  public evaluate(blinksPerMinute: number, currentTime: number = Date.now()): void {
    const isCurrentlyLow = blinksPerMinute < this.config.thresholdBpm;

    if (isCurrentlyLow) {
      if (!this.state.isBlinkRateLow) {
        this.state.isBlinkRateLow = true;
        this.state.lowRateStartTime = currentTime;
        console.log(
          `[BlinkPolicy] Blink rate dropped below threshold: ${blinksPerMinute.toFixed(2)} < ${this.config.thresholdBpm}`
        );
      }

      const lowRateDuration = currentTime - (this.state.lowRateStartTime || currentTime);

      if (lowRateDuration >= this.config.requiredDurationMs) {
        if (this.shouldTriggerNotification(currentTime)) {
          this.triggerNotification(blinksPerMinute);
          this.state.lastNotificationTime = currentTime;
          console.log(
            `[BlinkPolicy] Notification triggered for low blink rate: ${blinksPerMinute.toFixed(2)} bpm`
          );
        }
      }
    } else {
      if (this.state.isBlinkRateLow) {
        console.log(
          `[BlinkPolicy] Blink rate returned to normal: ${blinksPerMinute.toFixed(2)} >= ${this.config.thresholdBpm}`
        );
        this.state.isBlinkRateLow = false;
        this.state.lowRateStartTime = null;
      }
    }
  }

  public reset(): void {
    this.state = {
      isBlinkRateLow: false,
      lowRateStartTime: null,
      lastNotificationTime: null,
    };
  }

  public updateConfig(config: Partial<BlinkPolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getState(): Readonly<BlinkPolicyState> {
    return { ...this.state };
  }

  public getConfig(): Readonly<BlinkPolicyConfig> {
    return { ...this.config };
  }

  private shouldTriggerNotification(currentTime: number): boolean {
    if (this.state.lastNotificationTime === null) {
      return true;
    }

    const timeSinceLastNotification = currentTime - this.state.lastNotificationTime;
    return timeSinceLastNotification >= this.config.cooldownMs;
  }

  private triggerNotification(blinksPerMinute: number): void {
    showNotification({
      title: 'Low blink rate detected',
      body: `You're blinking ${Math.round(blinksPerMinute)} times per minute. Remember to blink regularly to keep your eyes healthy.`,
    });
  }
}

export function createBlinkPolicy(config?: Partial<BlinkPolicyConfig>): BlinkPolicy {
  return new BlinkPolicy(config);
}
