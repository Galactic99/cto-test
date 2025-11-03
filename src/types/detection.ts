import { FpsMode, DetectionFeatures } from './settings';

export interface BlinkMetrics {
  timestamp: number;
  blinkCount: number;
  blinkRate: number; // blinks per minute
  lastBlinkTime?: number;
}

export interface PostureMetrics {
  timestamp: number;
  postureScore?: number;
  headPitchAngle?: number;
  shoulderRollAngle?: number;
  goodPosturePercent?: number;
  badPostureCount?: number;
  lastPostureCheckTime?: number;
  currentPosture?: 'good' | 'bad' | 'unknown';
}

export interface DetectionMetrics {
  blink?: BlinkMetrics;
  posture?: PostureMetrics;
}

export interface DetectionStatus {
  isRunning: boolean;
  features: DetectionFeatures;
  fpsMode: FpsMode;
  lastUpdate?: number;
  error?: DetectionError;
}

export type DetectionErrorType =
  | 'camera_permission_denied'
  | 'camera_not_found'
  | 'camera_in_use'
  | 'model_load_failed'
  | 'runtime_error'
  | 'unknown';

export interface DetectionError {
  type: DetectionErrorType;
  message: string;
  timestamp: number;
  retryable: boolean;
  retryCount?: number;
}
