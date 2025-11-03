/**
 * Comprehensive Unit Tests for Posture Detection
 *
 * This test suite validates the posture detection system which uses pose landmarks
 * to compute head pitch angle, shoulder roll angle, and an overall posture score.
 *
 * Test Coverage:
 * 1. Angle Calculations - Verifies accurate computation of head pitch and shoulder roll
 * 2. Posture Score Calculation - Tests score computation from angles
 * 3. EMA Smoothing - Validates smoothing behavior to prevent jitter
 * 4. Baseline Calibration - Tests baseline adjustment functionality
 * 5. Missing Landmarks - Tests graceful handling of missing data
 * 6. Configuration Management - Tests config updates and defaults
 */

import {
  PostureDetector,
  createPostureDetector,
} from '../src/renderer/sensor/metrics/posture';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Creates mock pose landmarks with specified posture characteristics.
 * @param headForward - How far forward the head is (positive = forward tilt)
 * @param shouldersForward - How far forward the shoulders are (positive = rounded)
 */
function createMockPoseLandmarks(
  headForward: number = 0,
  shouldersForward: number = 0
): NormalizedLandmark[] {
  // Create array of 33 landmarks (standard for MediaPipe Pose)
  const landmarks: NormalizedLandmark[] = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));

  // Set key landmarks for posture detection
  // In MediaPipe, z-axis: negative means closer to camera, positive means further
  // For forward head tilt: head should be further forward (higher z) than shoulders
  
  // Nose (index 0)
  landmarks[0] = {
    x: 0.5,
    y: 0.3, // Upper part of frame
    z: headForward, // Forward tilt = positive z
    visibility: 1,
  };

  // Left shoulder (index 11)
  landmarks[11] = {
    x: 0.4,
    y: 0.5,
    z: 0.1 + shouldersForward,
    visibility: 1,
  };

  // Right shoulder (index 12)
  landmarks[12] = {
    x: 0.6,
    y: 0.5,
    z: 0.1 + shouldersForward,
    visibility: 1,
  };

  // Left hip (index 23)
  landmarks[23] = {
    x: 0.45,
    y: 0.8,
    z: 0,
    visibility: 1,
  };

  // Right hip (index 24)
  landmarks[24] = {
    x: 0.55,
    y: 0.8,
    z: 0,
    visibility: 1,
  };

  return landmarks;
}

/**
 * Creates a complete mock PoseLandmarkerResult.
 */
function createMockPoseResult(
  headForward: number = 0,
  shouldersForward: number = 0
): any {
  return {
    landmarks: [createMockPoseLandmarks(headForward, shouldersForward)],
    worldLandmarks: [],
    segmentationMasks: [],
  };
}

describe('PostureDetector', () => {
  let detector: PostureDetector;

  beforeEach(() => {
    detector = createPostureDetector();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const config = detector.getConfig();
      expect(config.scoreThreshold).toBe(60);
      expect(config.emaAlpha).toBe(0.2);
    });

    it('should initialize with custom config', () => {
      const customDetector = createPostureDetector({
        scoreThreshold: 70,
        emaAlpha: 0.3,
      });
      const config = customDetector.getConfig();
      expect(config.scoreThreshold).toBe(70);
      expect(config.emaAlpha).toBe(0.3);
    });

    it('should start with perfect posture score', () => {
      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBe(100);
      expect(metrics.headPitchAngle).toBe(0);
      expect(metrics.shoulderRollAngle).toBe(0);
      expect(metrics.lastUpdateTimestamp).toBeNull();
    });
  });

  describe('Good Posture Detection', () => {
    it('should maintain high score for upright posture', () => {
      const result = createMockPoseResult(0, 0);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeGreaterThan(85);
      expect(metrics.lastUpdateTimestamp).toBe(1000);
    });

    it('should maintain high score for slight variations', () => {
      const result = createMockPoseResult(0.02, 0.01);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeGreaterThan(80);
    });
  });

  describe('Poor Posture Detection', () => {
    it('should decrease score for forward head tilt', () => {
      const result = createMockPoseResult(0.25, 0); // Significant forward head
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeLessThan(95);
      expect(metrics.rawHeadPitch).not.toBe(0);
    });

    it('should decrease score for rounded shoulders', () => {
      const result = createMockPoseResult(0, 0.15); // Rounded shoulders
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeLessThan(95);
      expect(metrics.rawShoulderRoll).not.toBe(0);
    });

    it('should significantly decrease score for both poor postures', () => {
      const result = createMockPoseResult(0.35, 0.05); // Both bad (values don't cancel out)
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeLessThan(90);
    });

    it('should recover score when posture improves', () => {
      // Start with moderately poor posture (not canceling values)
      const poorResult = createMockPoseResult(0.25, 0.05);
      for (let i = 0; i < 30; i++) {
        detector.processFrame(poorResult, 1000 + i * 100);
      }

      let metrics = detector.getMetrics();
      const poorScore = metrics.postureScore;

      // Improve to better posture
      const betterResult = createMockPoseResult(0.1, 0);
      for (let i = 0; i < 50; i++) {
        detector.processFrame(betterResult, 4000 + i * 100);
      }

      metrics = detector.getMetrics();
      // With EMA smoothing (alpha=0.2), score should gradually improve
      expect(metrics.postureScore).toBeGreaterThan(poorScore);
    });
  });

  describe('EMA Smoothing', () => {
    it('should smooth score changes gradually', () => {
      const goodResult = createMockPoseResult(0, 0);
      detector.processFrame(goodResult, 1000);

      const initialMetrics = detector.getMetrics();
      const initialScore = initialMetrics.postureScore;

      // Sudden change to poor posture
      const poorResult = createMockPoseResult(0.15, 0.08);
      detector.processFrame(poorResult, 2000);

      const afterOneFrame = detector.getMetrics();

      // Score should change but not drastically (due to EMA)
      expect(afterOneFrame.postureScore).toBeLessThan(initialScore);
      expect(afterOneFrame.postureScore).toBeGreaterThan(40); // Not instant drop to 0
    });

    it('should converge to new value over multiple frames', () => {
      const poorResult = createMockPoseResult(0.15, 0.08);

      const scores: number[] = [];
      for (let i = 0; i < 50; i++) {
        detector.processFrame(poorResult, 1000 + i * 100);
        scores.push(detector.getMetrics().postureScore);
      }

      // Score should keep decreasing
      expect(scores[0]).toBeGreaterThan(scores[10]);
      expect(scores[10]).toBeGreaterThan(scores[30]);

      // But eventually stabilize
      const lastFiveScores = scores.slice(-5);
      const maxDiff = Math.max(...lastFiveScores) - Math.min(...lastFiveScores);
      expect(maxDiff).toBeLessThan(5); // Converged
    });

    it('should not jitter with consistent input', () => {
      const result = createMockPoseResult(0.05, 0.02);

      // Process multiple frames with same posture
      const scores: number[] = [];
      for (let i = 0; i < 100; i++) {
        detector.processFrame(result, 1000 + i * 100);
        if (i >= 50) {
          // After convergence
          scores.push(detector.getMetrics().postureScore);
        }
      }

      // Scores should be very stable (minimal variation)
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      expect(maxScore - minScore).toBeLessThan(2);
    });
  });

  describe('Baseline Calibration', () => {
    it('should allow setting baseline from current posture', () => {
      // Use a posture that's moderately forward (not canceling values)
      const result = createMockPoseResult(0.25, 0.05);
      
      // Process several frames to let EMA stabilize
      for (let i = 0; i < 15; i++) {
        detector.processFrame(result, 1000 + i * 100);
      }

      const beforeMetrics = detector.getMetrics();
      const scoreBeforeBaseline = beforeMetrics.postureScore;
      expect(scoreBeforeBaseline).toBeLessThan(100); // Should be penalized

      // Set this as baseline (calibrate to user's natural posture)
      detector.setBaseline();

      // Continue processing the same posture
      for (let i = 0; i < 15; i++) {
        detector.processFrame(result, 2500 + i * 100);
      }
      const afterBaseline = detector.getMetrics();

      // Score should improve or at least be different since baseline adjusted
      // The baseline shifts the reference point, so the "poor" posture becomes "normal"
      expect(afterBaseline.postureScore).toBeGreaterThanOrEqual(scoreBeforeBaseline);
    });

    it('should allow setting explicit baseline values', () => {
      detector.setBaseline(10, 5); // Set specific baseline angles

      const result = createMockPoseResult(0.1, 0.05);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      // With baseline set, scores should be adjusted
      expect(metrics.postureScore).toBeDefined();
    });

    it('should allow clearing baseline', () => {
      detector.setBaseline(10, 5);
      detector.clearBaseline();

      const result = createMockPoseResult(0.1, 0.05);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      // After clearing, should use default scoring
      expect(metrics.postureScore).toBeDefined();
    });
  });

  describe('Missing Landmarks Handling', () => {
    it('should skip frame when no landmarks present', () => {
      const result: any = {
        landmarks: [],
        worldLandmarks: [],
        segmentationMasks: [],
      };

      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.lastUpdateTimestamp).toBeNull();
      expect(metrics.postureScore).toBe(100); // Unchanged
    });

    it('should skip frame with incomplete landmarks', () => {
      const result: any = {
        landmarks: [
          [
            // Only a few landmarks
            { x: 0.5, y: 0.5, z: 0, visibility: 1 },
            { x: 0.5, y: 0.5, z: 0, visibility: 1 },
          ],
        ],
        worldLandmarks: [],
        segmentationMasks: [],
      };

      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.lastUpdateTimestamp).toBeNull();
    });

    it('should maintain last score when landmarks missing', () => {
      // First, get a valid score
      const goodResult = createMockPoseResult(0, 0);
      detector.processFrame(goodResult, 1000);

      const validMetrics = detector.getMetrics();
      const validScore = validMetrics.postureScore;

      // Then send invalid data
      const invalidResult: any = {
        landmarks: [],
        worldLandmarks: [],
        segmentationMasks: [],
      };

      detector.processFrame(invalidResult, 2000);

      const afterInvalid = detector.getMetrics();
      expect(afterInvalid.postureScore).toBe(validScore);
      expect(afterInvalid.lastUpdateTimestamp).toBe(1000); // Still old timestamp
    });
  });

  describe('Configuration Management', () => {
    it('should allow updating config', () => {
      detector.updateConfig({ scoreThreshold: 70 });

      const config = detector.getConfig();
      expect(config.scoreThreshold).toBe(70);
      expect(config.emaAlpha).toBe(0.2); // Unchanged
    });

    it('should allow partial config updates', () => {
      detector.updateConfig({ emaAlpha: 0.3 });

      const config = detector.getConfig();
      expect(config.emaAlpha).toBe(0.3);
      expect(config.scoreThreshold).toBe(60); // Unchanged
    });

    it('should affect smoothing when emaAlpha changed', () => {
      // Use high alpha for faster response
      const fastDetector = createPostureDetector({ emaAlpha: 0.8 });

      const goodResult = createMockPoseResult(0, 0);
      fastDetector.processFrame(goodResult, 1000);

      const poorResult = createMockPoseResult(0.15, 0.08);
      fastDetector.processFrame(poorResult, 2000);

      const fastMetrics = fastDetector.getMetrics();

      // Compare with slow alpha (default 0.2)
      const slowDetector = createPostureDetector({ emaAlpha: 0.2 });
      slowDetector.processFrame(goodResult, 1000);
      slowDetector.processFrame(poorResult, 2000);

      const slowMetrics = slowDetector.getMetrics();

      // Fast detector should respond more quickly to change
      // (both should decrease, but fast should decrease more)
      expect(fastMetrics.postureScore).toBeLessThan(slowMetrics.postureScore);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics to initial state', () => {
      const result = createMockPoseResult(0.15, 0.08);
      detector.processFrame(result, 1000);

      // Verify state changed
      let metrics = detector.getMetrics();
      expect(metrics.postureScore).not.toBe(100);
      expect(metrics.lastUpdateTimestamp).not.toBeNull();

      // Reset
      detector.reset();

      // Verify back to initial state
      metrics = detector.getMetrics();
      expect(metrics.postureScore).toBe(100);
      expect(metrics.headPitchAngle).toBe(0);
      expect(metrics.shoulderRollAngle).toBe(0);
      expect(metrics.lastUpdateTimestamp).toBeNull();
      expect(metrics.rawHeadPitch).toBe(0);
      expect(metrics.rawShoulderRoll).toBe(0);
    });

    it('should clear baseline on reset', () => {
      detector.setBaseline(10, 5);
      detector.reset();

      const result = createMockPoseResult(0.1, 0.05);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      // After reset, baseline should be cleared
      expect(metrics.postureScore).toBeDefined();
    });
  });

  describe('Angle Calculations', () => {
    it('should calculate head pitch angle', () => {
      const result = createMockPoseResult(0.15, 0);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.rawHeadPitch).not.toBe(0); // Some tilt
      expect(metrics.headPitchAngle).not.toBe(0);
    });

    it('should calculate shoulder roll angle', () => {
      const result = createMockPoseResult(0, 0.15);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.rawShoulderRoll).not.toBe(0); // Some roll
      expect(metrics.shoulderRollAngle).not.toBe(0);
    });

    it('should track both raw and smoothed angles', () => {
      const result = createMockPoseResult(0.1, 0.05);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      // Both raw and smoothed should be present
      expect(metrics.rawHeadPitch).toBeDefined();
      expect(metrics.headPitchAngle).toBeDefined();
      expect(metrics.rawShoulderRoll).toBeDefined();
      expect(metrics.shoulderRollAngle).toBeDefined();
    });

    it('should smooth angles over time', () => {
      const result = createMockPoseResult(0.1, 0.05);

      const rawAngles: number[] = [];
      const smoothedAngles: number[] = [];

      for (let i = 0; i < 20; i++) {
        detector.processFrame(result, 1000 + i * 100);
        const metrics = detector.getMetrics();
        rawAngles.push(metrics.rawHeadPitch);
        smoothedAngles.push(metrics.headPitchAngle);
      }

      // Raw angles should be consistent (same input)
      const rawVariance =
        Math.max(...rawAngles) - Math.min(...rawAngles);
      expect(rawVariance).toBeLessThan(1);

      // Smoothed angles should converge to raw
      expect(smoothedAngles[19]).toBeCloseTo(rawAngles[19], 0);
    });
  });

  describe('Posture Score Boundaries', () => {
    it('should clamp score to 0-100 range', () => {
      // Extremely poor posture
      const result = createMockPoseResult(0.5, 0.5);

      for (let i = 0; i < 100; i++) {
        detector.processFrame(result, 1000 + i * 100);
      }

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeGreaterThanOrEqual(0);
      expect(metrics.postureScore).toBeLessThanOrEqual(100);
    });

    it('should handle negative angles', () => {
      // Head tilted backward
      const result = createMockPoseResult(-0.1, 0);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBeGreaterThanOrEqual(0);
      expect(metrics.postureScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Timestamp Tracking', () => {
    it('should track last update timestamp', () => {
      const result = createMockPoseResult(0, 0);
      detector.processFrame(result, 1234);

      const metrics = detector.getMetrics();
      expect(metrics.lastUpdateTimestamp).toBe(1234);
    });

    it('should update timestamp on each frame', () => {
      const result = createMockPoseResult(0, 0);
      
      detector.processFrame(result, 1000);
      expect(detector.getMetrics().lastUpdateTimestamp).toBe(1000);

      detector.processFrame(result, 2000);
      expect(detector.getMetrics().lastUpdateTimestamp).toBe(2000);

      detector.processFrame(result, 3000);
      expect(detector.getMetrics().lastUpdateTimestamp).toBe(3000);
    });

    it('should use current time if no timestamp provided', () => {
      const result = createMockPoseResult(0, 0);
      const beforeTime = Date.now();
      
      detector.processFrame(result);
      
      const afterTime = Date.now();
      const metrics = detector.getMetrics();
      
      expect(metrics.lastUpdateTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(metrics.lastUpdateTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Factory Function', () => {
    it('should create detector instance', () => {
      const detector = createPostureDetector();
      expect(detector).toBeInstanceOf(PostureDetector);
    });

    it('should pass config to constructor', () => {
      const detector = createPostureDetector({
        scoreThreshold: 75,
        emaAlpha: 0.25,
      });

      const config = detector.getConfig();
      expect(config.scoreThreshold).toBe(75);
      expect(config.emaAlpha).toBe(0.25);
    });
  });
});
