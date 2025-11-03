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
}
