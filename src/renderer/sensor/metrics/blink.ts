import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface BlinkConfig {
  earThreshold: number;
  consecutiveFrames: number;
  debounceFrames: number;
}

export interface BlinkMetrics {
  blinkCount: number;
  leftEyeEAR: number;
  rightEyeEAR: number;
  averageEAR: number;
  lastBlinkTimestamp: number | null;
  blinksPerMinute: number;
}

const DEFAULT_BLINK_CONFIG: BlinkConfig = {
  earThreshold: 0.21,
  consecutiveFrames: 2,
  debounceFrames: 2,
};

const LEFT_EYE_INDICES = {
  leftCorner: 33,
  rightCorner: 133,
  topLeft: 160,
  topRight: 158,
  bottomLeft: 144,
  bottomRight: 153,
};

const RIGHT_EYE_INDICES = {
  leftCorner: 362,
  rightCorner: 263,
  topLeft: 385,
  topRight: 387,
  bottomLeft: 380,
  bottomRight: 373,
};

export class BlinkDetector {
  private config: BlinkConfig;
  private blinkCount: number = 0;
  private consecutiveClosedFrames: number = 0;
  private consecutiveOpenFrames: number = 0;
  private isBlinking: boolean = false;
  private leftEyeEAR: number = 0;
  private rightEyeEAR: number = 0;
  private lastBlinkTimestamp: number | null = null;
  private blinkTimestamps: number[] = [];
  private readonly BLINK_HISTORY_WINDOW_MS = 60000;

  constructor(config: Partial<BlinkConfig> = {}) {
    this.config = { ...DEFAULT_BLINK_CONFIG, ...config };
  }

  private calculateDistance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateEAR(
    landmarks: NormalizedLandmark[],
    eyeIndices: typeof LEFT_EYE_INDICES
  ): number {
    const leftCorner = landmarks[eyeIndices.leftCorner];
    const rightCorner = landmarks[eyeIndices.rightCorner];
    const topLeft = landmarks[eyeIndices.topLeft];
    const topRight = landmarks[eyeIndices.topRight];
    const bottomLeft = landmarks[eyeIndices.bottomLeft];
    const bottomRight = landmarks[eyeIndices.bottomRight];

    if (!leftCorner || !rightCorner || !topLeft || !topRight || !bottomLeft || !bottomRight) {
      return 0;
    }

    const verticalDist1 = this.calculateDistance(topLeft, bottomLeft);
    const verticalDist2 = this.calculateDistance(topRight, bottomRight);
    const horizontalDist = this.calculateDistance(leftCorner, rightCorner);

    if (horizontalDist === 0) {
      return 0;
    }

    const ear = (verticalDist1 + verticalDist2) / (2.0 * horizontalDist);
    return ear;
  }

  private cleanupOldBlinks(currentTime: number): void {
    const cutoffTime = currentTime - this.BLINK_HISTORY_WINDOW_MS;
    this.blinkTimestamps = this.blinkTimestamps.filter((timestamp) => timestamp > cutoffTime);
  }

  private calculateBlinksPerMinute(currentTime: number): number {
    this.cleanupOldBlinks(currentTime);
    return this.blinkTimestamps.length;
  }

  public processFrame(result: FaceLandmarkerResult, timestamp: number = Date.now()): void {
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return;
    }

    const landmarks = result.faceLandmarks[0];

    this.leftEyeEAR = this.calculateEAR(landmarks, LEFT_EYE_INDICES);
    this.rightEyeEAR = this.calculateEAR(landmarks, RIGHT_EYE_INDICES);

    const averageEAR = (this.leftEyeEAR + this.rightEyeEAR) / 2.0;

    if (averageEAR < this.config.earThreshold) {
      this.consecutiveClosedFrames++;
      this.consecutiveOpenFrames = 0;

      if (
        this.consecutiveClosedFrames >= this.config.consecutiveFrames &&
        !this.isBlinking
      ) {
        this.isBlinking = true;
        this.blinkCount++;
        this.lastBlinkTimestamp = timestamp;
        this.blinkTimestamps.push(timestamp);
        console.log(
          `[BlinkDetector] Blink detected! Count: ${this.blinkCount}, EAR: ${averageEAR.toFixed(3)}`
        );
      }
    } else {
      this.consecutiveClosedFrames = 0;
      this.consecutiveOpenFrames++;

      if (this.consecutiveOpenFrames >= this.config.debounceFrames && this.isBlinking) {
        this.isBlinking = false;
      }
    }
  }

  public getMetrics(currentTime: number = Date.now()): BlinkMetrics {
    return {
      blinkCount: this.blinkCount,
      leftEyeEAR: this.leftEyeEAR,
      rightEyeEAR: this.rightEyeEAR,
      averageEAR: (this.leftEyeEAR + this.rightEyeEAR) / 2.0,
      lastBlinkTimestamp: this.lastBlinkTimestamp,
      blinksPerMinute: this.calculateBlinksPerMinute(currentTime),
    };
  }

  public reset(): void {
    this.blinkCount = 0;
    this.consecutiveClosedFrames = 0;
    this.consecutiveOpenFrames = 0;
    this.isBlinking = false;
    this.leftEyeEAR = 0;
    this.rightEyeEAR = 0;
    this.lastBlinkTimestamp = null;
    this.blinkTimestamps = [];
  }

  public updateConfig(config: Partial<BlinkConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): BlinkConfig {
    return { ...this.config };
  }
}

export function createBlinkDetector(config?: Partial<BlinkConfig>): BlinkDetector {
  return new BlinkDetector(config);
}
