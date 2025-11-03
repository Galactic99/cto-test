import { showNotification } from '../system/notifications';
import { getSettings } from '../store/settings';

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

export interface PosturePolicyConfig {
  scoreThreshold: number;
  cooldownMs: number;
  minRequiredDurationMs: number;
  maxRequiredDurationMs: number;
  improvementThreshold: number;
}

interface PosturePolicyState {
  isPosturePoor: boolean;
  poorPostureStartTime: number | null;
  lastNotificationTime: number | null;
  scoreAtNotification: number | null;
}

const DEFAULT_POSTURE_CONFIG: PosturePolicyConfig = {
  scoreThreshold: 60,
  cooldownMs: 15 * 60 * 1000, // 15 minutes
  minRequiredDurationMs: 30 * 1000, // 30 seconds
  maxRequiredDurationMs: 60 * 1000, // 60 seconds
  improvementThreshold: 15,
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

export class PosturePolicy {
  private config: PosturePolicyConfig;
  private state: PosturePolicyState;

  constructor(config: Partial<PosturePolicyConfig> = {}) {
    this.config = { ...DEFAULT_POSTURE_CONFIG, ...config };
    this.state = {
      isPosturePoor: false,
      poorPostureStartTime: null,
      lastNotificationTime: null,
      scoreAtNotification: null,
    };
  }

  public evaluate(postureScore: number, currentTime: number = Date.now()): void {
    const settings = getSettings();
    const isDetectionEnabled = settings.detection.enabled && settings.detection.privacyConsentGiven;
    const isPostureFeatureEnabled = settings.detection.features?.posture ?? true;

    if (!isDetectionEnabled || !isPostureFeatureEnabled) {
      return;
    }

    const isCurrentlyPoor = postureScore < this.config.scoreThreshold;

    if (isCurrentlyPoor) {
      if (!this.state.isPosturePoor) {
        this.state.isPosturePoor = true;
        this.state.poorPostureStartTime = currentTime;
        console.log(
          `[PosturePolicy] Posture score dropped below threshold: ${postureScore.toFixed(2)} < ${this.config.scoreThreshold}`
        );
      }

      const poorPostureDuration = currentTime - (this.state.poorPostureStartTime || currentTime);

      if (poorPostureDuration >= this.config.minRequiredDurationMs) {
        if (this.shouldTriggerNotification(currentTime)) {
          this.triggerNotification(postureScore);
          this.state.lastNotificationTime = currentTime;
          this.state.scoreAtNotification = postureScore;
          console.log(
            `[PosturePolicy] Notification triggered for poor posture: score ${postureScore.toFixed(2)}`
          );
        }
      }
    } else {
      if (this.state.isPosturePoor) {
        console.log(
          `[PosturePolicy] Posture score returned to normal: ${postureScore.toFixed(2)} >= ${this.config.scoreThreshold}`
        );
        this.state.isPosturePoor = false;
        this.state.poorPostureStartTime = null;
      }

      if (this.state.scoreAtNotification !== null) {
        const improvement = postureScore - this.state.scoreAtNotification;
        if (improvement > this.config.improvementThreshold) {
          console.log(
            `[PosturePolicy] Posture improved by ${improvement.toFixed(2)} points, resetting cooldown`
          );
          this.state.lastNotificationTime = null;
          this.state.scoreAtNotification = null;
        }
      }
    }
  }

  public reset(): void {
    this.state = {
      isPosturePoor: false,
      poorPostureStartTime: null,
      lastNotificationTime: null,
      scoreAtNotification: null,
    };
  }

  public updateConfig(config: Partial<PosturePolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getState(): Readonly<PosturePolicyState> {
    return { ...this.state };
  }

  public getConfig(): Readonly<PosturePolicyConfig> {
    return { ...this.config };
  }

  private shouldTriggerNotification(currentTime: number): boolean {
    if (this.state.lastNotificationTime === null) {
      return true;
    }

    const timeSinceLastNotification = currentTime - this.state.lastNotificationTime;
    return timeSinceLastNotification >= this.config.cooldownMs;
  }

  private triggerNotification(postureScore: number): void {
    showNotification({
      title: 'Poor posture detected',
      body: `Your posture score is ${Math.round(postureScore)}/100. Sit upright, relax your shoulders, and keep your feet flat.`,
    });
  }
}

export function createPosturePolicy(config?: Partial<PosturePolicyConfig>): PosturePolicy {
  return new PosturePolicy(config);
}
