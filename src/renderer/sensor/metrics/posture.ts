import { PoseLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface PostureConfig {
  scoreThreshold: number;
  emaAlpha: number;
}

export interface PostureMetrics {
  postureScore: number;
  headPitchAngle: number;
  shoulderRollAngle: number;
  lastUpdateTimestamp: number | null;
  rawHeadPitch: number;
  rawShoulderRoll: number;
}

const DEFAULT_POSTURE_CONFIG: PostureConfig = {
  scoreThreshold: 60,
  emaAlpha: 0.2,
};

// MediaPipe Pose Landmark indices
const POSE_LANDMARKS = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
};

export class PostureDetector {
  private config: PostureConfig;
  private postureScore: number = 100;
  private headPitchAngle: number = 0;
  private shoulderRollAngle: number = 0;
  private rawHeadPitch: number = 0;
  private rawShoulderRoll: number = 0;
  private lastUpdateTimestamp: number | null = null;
  private baselineHeadPitch: number = 0;
  private baselineShoulderRoll: number = 0;
  private hasBaseline: boolean = false;

  constructor(config: Partial<PostureConfig> = {}) {
    this.config = { ...DEFAULT_POSTURE_CONFIG, ...config };
  }

  /**
   * Calculate head pitch angle (forward tilt from vertical).
   * Positive angle means head is tilted forward (poor posture).
   * Uses nose and shoulder midpoint to determine head angle.
   */
  private calculateHeadPitch(landmarks: NormalizedLandmark[]): number | null {
    const nose = landmarks[POSE_LANDMARKS.nose];
    const leftShoulder = landmarks[POSE_LANDMARKS.leftShoulder];
    const rightShoulder = landmarks[POSE_LANDMARKS.rightShoulder];

    if (!nose || !leftShoulder || !rightShoulder) {
      return null;
    }

    // Calculate shoulder midpoint
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderMidZ = (leftShoulder.z + rightShoulder.z) / 2;

    // Calculate forward displacement (z-axis) and vertical displacement (y-axis)
    const forwardDisplacement = nose.z - shoulderMidZ;
    const verticalDisplacement = shoulderMidY - nose.y; // Inverted because y increases downward

    // Calculate angle from vertical (in degrees)
    // Positive angle = head forward, negative = head back
    const angle = Math.atan2(forwardDisplacement, verticalDisplacement) * (180 / Math.PI);

    return angle;
  }

  /**
   * Calculate shoulder roll angle (rounded shoulders).
   * Positive angle means shoulders are rolled forward (poor posture).
   * Uses shoulder z-coordinates and vertical position.
   */
  private calculateShoulderRoll(landmarks: NormalizedLandmark[]): number | null {
    const leftShoulder = landmarks[POSE_LANDMARKS.leftShoulder];
    const rightShoulder = landmarks[POSE_LANDMARKS.rightShoulder];
    const nose = landmarks[POSE_LANDMARKS.nose];

    if (!leftShoulder || !rightShoulder || !nose) {
      return null;
    }

    // Calculate average shoulder z-position relative to nose
    const shoulderAvgZ = (leftShoulder.z + rightShoulder.z) / 2;
    const shoulderForwardness = shoulderAvgZ - nose.z;

    // Convert to angle (more forward = higher angle)
    // Scale by 100 to get reasonable angle values
    const angle = shoulderForwardness * 100;

    return angle;
  }

  /**
   * Combine head pitch and shoulder roll into a single posture score (0-100).
   * Score of 100 = perfect posture, 0 = very poor posture.
   * Uses baseline adjustments for calibration.
   */
  private calculatePostureScore(
    headPitch: number,
    shoulderRoll: number
  ): number {
    // Adjust angles relative to baseline if available
    const adjustedHeadPitch = this.hasBaseline
      ? headPitch - this.baselineHeadPitch
      : headPitch;
    const adjustedShoulderRoll = this.hasBaseline
      ? shoulderRoll - this.baselineShoulderRoll
      : shoulderRoll;

    // Define thresholds for poor posture
    // Head pitch: > 15 degrees forward is poor
    // Shoulder roll: > 5 units forward is poor
    const headPitchPenalty = Math.max(0, Math.abs(adjustedHeadPitch) / 15) * 50;
    const shoulderRollPenalty = Math.max(0, Math.abs(adjustedShoulderRoll) / 5) * 50;

    // Calculate score (100 - penalties)
    const rawScore = 100 - headPitchPenalty - shoulderRollPenalty;

    // Clamp to 0-100 range
    return Math.max(0, Math.min(100, rawScore));
  }

  /**
   * Apply Exponential Moving Average (EMA) smoothing to reduce jitter.
   */
  private applyEMA(newValue: number, oldValue: number): number {
    return this.config.emaAlpha * newValue + (1 - this.config.emaAlpha) * oldValue;
  }

  public processFrame(
    result: PoseLandmarkerResult,
    timestamp: number = Date.now()
  ): void {
    if (!result.landmarks || result.landmarks.length === 0) {
      return;
    }

    const landmarks = result.landmarks[0];

    // Calculate raw angles
    const headPitch = this.calculateHeadPitch(landmarks);
    const shoulderRoll = this.calculateShoulderRoll(landmarks);

    // Skip frame if landmarks are missing
    if (headPitch === null || shoulderRoll === null) {
      return;
    }

    // Store raw values
    this.rawHeadPitch = headPitch;
    this.rawShoulderRoll = shoulderRoll;

    // Apply EMA smoothing
    this.headPitchAngle = this.applyEMA(headPitch, this.headPitchAngle);
    this.shoulderRollAngle = this.applyEMA(shoulderRoll, this.shoulderRollAngle);

    // Calculate posture score
    const rawScore = this.calculatePostureScore(
      this.headPitchAngle,
      this.shoulderRollAngle
    );

    // Apply EMA to score
    this.postureScore = this.applyEMA(rawScore, this.postureScore);

    this.lastUpdateTimestamp = timestamp;
  }

  public getMetrics(): PostureMetrics {
    return {
      postureScore: this.postureScore,
      headPitchAngle: this.headPitchAngle,
      shoulderRollAngle: this.shoulderRollAngle,
      lastUpdateTimestamp: this.lastUpdateTimestamp,
      rawHeadPitch: this.rawHeadPitch,
      rawShoulderRoll: this.rawShoulderRoll,
    };
  }

  public reset(): void {
    this.postureScore = 100;
    this.headPitchAngle = 0;
    this.shoulderRollAngle = 0;
    this.rawHeadPitch = 0;
    this.rawShoulderRoll = 0;
    this.lastUpdateTimestamp = null;
    this.baselineHeadPitch = 0;
    this.baselineShoulderRoll = 0;
    this.hasBaseline = false;
  }

  public updateConfig(config: Partial<PostureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): PostureConfig {
    return { ...this.config };
  }

  /**
   * Set baseline values for calibration.
   * Call this when user is in good posture to establish reference point.
   */
  public setBaseline(headPitch?: number, shoulderRoll?: number): void {
    if (headPitch !== undefined) {
      this.baselineHeadPitch = headPitch;
    } else {
      this.baselineHeadPitch = this.headPitchAngle;
    }

    if (shoulderRoll !== undefined) {
      this.baselineShoulderRoll = shoulderRoll;
    } else {
      this.baselineShoulderRoll = this.shoulderRollAngle;
    }

    this.hasBaseline = true;
  }

  public clearBaseline(): void {
    this.baselineHeadPitch = 0;
    this.baselineShoulderRoll = 0;
    this.hasBaseline = false;
  }
}

export function createPostureDetector(
  config?: Partial<PostureConfig>
): PostureDetector {
  return new PostureDetector(config);
}
