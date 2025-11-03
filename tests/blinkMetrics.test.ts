/**
 * Comprehensive Unit Tests for Blink Detection Pipeline
 * 
 * This test suite validates the blink detection system which uses Eye Aspect Ratio (EAR)
 * to detect blinks in real-time from face landmark data.
 * 
 * Test Coverage:
 * 1. EAR Calculations - Verifies accurate computation of eye aspect ratios
 *    - Tests symmetric and asymmetric eye closures
 *    - Validates threshold boundary conditions
 * 
 * 2. Consecutive Frame Logic - Ensures blinks are detected only after sustained eye closure
 *    - Prevents false positives from quick glances or partial closures
 *    - Tests configurable consecutive frame requirements
 * 
 * 3. Cooldown/Debounce Logic - Validates proper spacing between detected blinks
 *    - Prevents double-counting of single blinks
 *    - Tests configurable debounce periods
 * 
 * 4. Rolling Window Aggregator - Tests blinks-per-minute calculation
 *    - Uses 60-second sliding window
 *    - Tests with Jest fake timers to simulate time passage
 * 
 * 5. Various Blink Patterns - Tests realistic usage scenarios
 *    - No blinks (sustained attention/concentration)
 *    - Rapid blinks (stress, eye irritation, fatigue)
 *    - Sustained low rate (deep focus, screen fatigue)
 *    - Mixed patterns (normal daily usage)
 * 
 * 6. Error Handling - Tests robustness against missing/invalid data
 *    - Missing face landmarks
 *    - Intermittent detection failures
 *    - Recovery from error states
 * 
 * 7. Configuration Tuning - Validates customizable detection parameters
 *    - EAR threshold adjustment
 *    - Consecutive frame requirements
 *    - Debounce timing
 *    - Runtime configuration updates
 */

import {
  BlinkDetector,
  createBlinkDetector,
  BlinkConfig,
} from '../src/renderer/sensor/metrics/blink';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Creates mock face landmarks with specified EAR values for each eye.
 * Uses geometric calculations to position eye landmarks that will produce
 * the desired EAR when processed by the detector.
 * 
 * @param leftEyeEAR - Target EAR value for left eye (0 = closed, ~0.3 = open)
 * @param rightEyeEAR - Target EAR value for right eye
 * @returns Array of 478 face landmarks with properly positioned eye landmarks
 */
function createMockLandmarks(leftEyeEAR: number, rightEyeEAR: number): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = new Array(478).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));

  const setEyeLandmarks = (
    leftCorner: number,
    rightCorner: number,
    topLeft: number,
    topRight: number,
    bottomLeft: number,
    bottomRight: number,
    targetEAR: number
  ) => {
    landmarks[leftCorner] = { x: 0.3, y: 0.5, z: 0, visibility: 1 };
    landmarks[rightCorner] = { x: 0.4, y: 0.5, z: 0, visibility: 1 };

    const horizontalDist = 0.1;
    const verticalDist = (targetEAR * horizontalDist * 2.0) / 2.0;

    landmarks[topLeft] = { x: 0.33, y: 0.5 - verticalDist / 2, z: 0, visibility: 1 };
    landmarks[topRight] = { x: 0.37, y: 0.5 - verticalDist / 2, z: 0, visibility: 1 };
    landmarks[bottomLeft] = { x: 0.33, y: 0.5 + verticalDist / 2, z: 0, visibility: 1 };
    landmarks[bottomRight] = { x: 0.37, y: 0.5 + verticalDist / 2, z: 0, visibility: 1 };
  };

  setEyeLandmarks(33, 133, 160, 158, 144, 153, leftEyeEAR);
  setEyeLandmarks(362, 263, 385, 387, 380, 373, rightEyeEAR);

  return landmarks;
}

/**
 * Creates a complete mock FaceLandmarkerResult with specified EAR values.
 * Convenience wrapper around createMockLandmarks for use in tests.
 * 
 * @param leftEyeEAR - Target EAR value for left eye
 * @param rightEyeEAR - Target EAR value for right eye
 * @returns Complete FaceLandmarkerResult object
 */
function createMockResult(leftEyeEAR: number, rightEyeEAR: number): FaceLandmarkerResult {
  return {
    faceLandmarks: [createMockLandmarks(leftEyeEAR, rightEyeEAR)],
    faceBlendshapes: [],
    facialTransformationMatrixes: [],
  };
}

describe('BlinkDetector', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = new BlinkDetector();
    jest.clearAllMocks();
  });

  describe('createBlinkDetector', () => {
    it('should create a blink detector instance', () => {
      const detector = createBlinkDetector();
      expect(detector).toBeInstanceOf(BlinkDetector);
    });

    it('should create detector with custom config', () => {
      const customConfig: Partial<BlinkConfig> = {
        earThreshold: 0.25,
        consecutiveFrames: 3,
      };
      const detector = createBlinkDetector(customConfig);
      const config = detector.getConfig();
      expect(config.earThreshold).toBe(0.25);
      expect(config.consecutiveFrames).toBe(3);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = detector.getConfig();
      expect(config.earThreshold).toBe(0.21);
      expect(config.consecutiveFrames).toBe(2);
      expect(config.debounceFrames).toBe(2);
    });

    it('should accept custom configuration in constructor', () => {
      const customDetector = new BlinkDetector({
        earThreshold: 0.25,
        consecutiveFrames: 3,
        debounceFrames: 3,
      });
      const config = customDetector.getConfig();
      expect(config.earThreshold).toBe(0.25);
      expect(config.consecutiveFrames).toBe(3);
      expect(config.debounceFrames).toBe(3);
    });

    it('should update configuration', () => {
      detector.updateConfig({ earThreshold: 0.18 });
      const config = detector.getConfig();
      expect(config.earThreshold).toBe(0.18);
      expect(config.consecutiveFrames).toBe(2);
    });
  });

  describe('EAR Calculation', () => {
    it('should calculate EAR for open eyes', () => {
      const result = createMockResult(0.3, 0.3);
      detector.processFrame(result);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBeGreaterThan(0.21);
      expect(metrics.rightEyeEAR).toBeGreaterThan(0.21);
      expect(metrics.averageEAR).toBeGreaterThan(0.21);
    });

    it('should calculate EAR for closed eyes', () => {
      const result = createMockResult(0.15, 0.15);
      detector.processFrame(result);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBeLessThan(0.21);
      expect(metrics.rightEyeEAR).toBeLessThan(0.21);
      expect(metrics.averageEAR).toBeLessThan(0.21);
    });

    it('should handle different EAR values for each eye', () => {
      const result = createMockResult(0.3, 0.15);
      detector.processFrame(result);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBeCloseTo(0.3, 1);
      expect(metrics.rightEyeEAR).toBeCloseTo(0.15, 1);
      expect(metrics.averageEAR).toBeCloseTo(0.225, 1);
    });

    it('should handle empty face landmarks', () => {
      const result: FaceLandmarkerResult = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      };
      detector.processFrame(result);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBe(0);
      expect(metrics.rightEyeEAR).toBe(0);
    });
  });

  describe('Blink Detection', () => {
    it('should not detect blink on first closed frame', () => {
      const result = createMockResult(0.15, 0.15);
      detector.processFrame(result, 1000);
      const metrics = detector.getMetrics();

      expect(metrics.blinkCount).toBe(0);
    });

    it('should detect blink after consecutive closed frames', () => {
      const result = createMockResult(0.15, 0.15);

      detector.processFrame(result, 1000);
      detector.processFrame(result, 1100);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
      expect(metrics.lastBlinkTimestamp).toBe(1100);
    });

    it('should require consecutive frames for blink detection', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(openResult, 1100);
      detector.processFrame(closedResult, 1200);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(0);
    });

    it('should detect multiple blinks', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.processFrame(openResult, 1200);
      detector.processFrame(openResult, 1300);
      detector.processFrame(closedResult, 1400);
      detector.processFrame(closedResult, 1500);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(2);
    });

    it('should debounce blinks to avoid double counting', () => {
      const closedResult = createMockResult(0.15, 0.15);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.processFrame(closedResult, 1200);
      detector.processFrame(closedResult, 1300);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should require debounce frames before next blink', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.processFrame(openResult, 1200);
      detector.processFrame(closedResult, 1300);
      detector.processFrame(closedResult, 1400);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should detect blink after proper debounce', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.processFrame(openResult, 1200);
      detector.processFrame(openResult, 1300);
      detector.processFrame(closedResult, 1400);
      detector.processFrame(closedResult, 1500);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(2);
    });

    it('should work with custom consecutive frames threshold', () => {
      const customDetector = new BlinkDetector({ consecutiveFrames: 3 });
      const result = createMockResult(0.15, 0.15);

      customDetector.processFrame(result, 1000);
      customDetector.processFrame(result, 1100);
      let metrics = customDetector.getMetrics();
      expect(metrics.blinkCount).toBe(0);

      customDetector.processFrame(result, 1200);
      metrics = customDetector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should work with custom EAR threshold', () => {
      const customDetector = new BlinkDetector({ earThreshold: 0.25 });
      const result = createMockResult(0.23, 0.23);

      customDetector.processFrame(result, 1000);
      customDetector.processFrame(result, 1100);

      const metrics = customDetector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });
  });

  describe('Blinks Per Minute', () => {
    it('should calculate blinks per minute', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      const startTime = Date.now();

      detector.processFrame(closedResult, startTime);
      detector.processFrame(closedResult, startTime + 100);
      detector.processFrame(openResult, startTime + 200);
      detector.processFrame(openResult, startTime + 300);
      detector.processFrame(closedResult, startTime + 10000);
      detector.processFrame(closedResult, startTime + 10100);

      const metrics = detector.getMetrics(startTime + 10200);
      expect(metrics.blinksPerMinute).toBe(2);
    });

    it('should only count blinks within last minute', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      const startTime = Date.now();

      detector.processFrame(closedResult, startTime);
      detector.processFrame(closedResult, startTime + 100);
      detector.processFrame(openResult, startTime + 200);
      detector.processFrame(openResult, startTime + 300);

      detector.processFrame(closedResult, startTime + 65000);
      detector.processFrame(closedResult, startTime + 65100);

      const metrics = detector.getMetrics(startTime + 65200);
      expect(metrics.blinksPerMinute).toBe(1);
    });

    it('should handle zero blinks per minute', () => {
      const openResult = createMockResult(0.3, 0.3);
      detector.processFrame(openResult);

      const metrics = detector.getMetrics();
      expect(metrics.blinksPerMinute).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should return initial metrics', () => {
      const metrics = detector.getMetrics();

      expect(metrics.blinkCount).toBe(0);
      expect(metrics.leftEyeEAR).toBe(0);
      expect(metrics.rightEyeEAR).toBe(0);
      expect(metrics.averageEAR).toBe(0);
      expect(metrics.lastBlinkTimestamp).toBeNull();
      expect(metrics.blinksPerMinute).toBe(0);
    });

    it('should update metrics after processing frames', () => {
      const result = createMockResult(0.3, 0.3);
      detector.processFrame(result, 1000);

      const metrics = detector.getMetrics();
      expect(metrics.leftEyeEAR).toBeGreaterThan(0);
      expect(metrics.rightEyeEAR).toBeGreaterThan(0);
      expect(metrics.averageEAR).toBeGreaterThan(0);
    });

    it('should track last blink timestamp', () => {
      const closedResult = createMockResult(0.15, 0.15);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);

      const metrics = detector.getMetrics();
      expect(metrics.lastBlinkTimestamp).toBe(1100);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      const closedResult = createMockResult(0.15, 0.15);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);

      detector.reset();
      const metrics = detector.getMetrics();

      expect(metrics.blinkCount).toBe(0);
      expect(metrics.leftEyeEAR).toBe(0);
      expect(metrics.rightEyeEAR).toBe(0);
      expect(metrics.averageEAR).toBe(0);
      expect(metrics.lastBlinkTimestamp).toBeNull();
      expect(metrics.blinksPerMinute).toBe(0);
    });

    it('should reset state for new blink detection', () => {
      const closedResult = createMockResult(0.15, 0.15);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.reset();

      detector.processFrame(closedResult, 2000);
      detector.processFrame(closedResult, 2100);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid eye movements', () => {
      const openResult = createMockResult(0.3, 0.3);
      const partialResult = createMockResult(0.22, 0.22);

      for (let i = 0; i < 10; i++) {
        detector.processFrame(i % 2 === 0 ? openResult : partialResult, i * 100);
      }

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(0);
    });

    it('should handle very long blinks', () => {
      const closedResult = createMockResult(0.15, 0.15);

      for (let i = 0; i < 20; i++) {
        detector.processFrame(closedResult, i * 100);
      }

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should handle missing face detection between blinks', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      const emptyResult: FaceLandmarkerResult = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      };

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.processFrame(openResult, 1200);
      detector.processFrame(openResult, 1300);
      detector.processFrame(emptyResult, 1400);
      detector.processFrame(closedResult, 1500);
      detector.processFrame(closedResult, 1600);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(2);
    });
  });

  describe('Frame Sequence Simulation', () => {
    it('should simulate realistic blink pattern at 10 FPS', () => {
      const openEAR = 0.3;
      const closedEAR = 0.15;
      const frameInterval = 100;
      let currentTime = 0;

      const simulateBlink = () => {
        detector.processFrame(createMockResult(closedEAR, closedEAR), currentTime);
        currentTime += frameInterval;
        detector.processFrame(createMockResult(closedEAR, closedEAR), currentTime);
        currentTime += frameInterval;
        detector.processFrame(createMockResult(closedEAR, closedEAR), currentTime);
        currentTime += frameInterval;
      };

      const simulateOpen = (frames: number) => {
        for (let i = 0; i < frames; i++) {
          detector.processFrame(createMockResult(openEAR, openEAR), currentTime);
          currentTime += frameInterval;
        }
      };

      simulateOpen(10);
      simulateBlink();
      simulateOpen(10);
      simulateBlink();
      simulateOpen(10);

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(2);
      expect(metrics.blinksPerMinute).toBe(2);
    });

    it('should handle rapid consecutive blinks with proper debouncing', () => {
      const timeline = [
        { ear: 0.15, time: 0 },
        { ear: 0.15, time: 100 },
        { ear: 0.3, time: 200 },
        { ear: 0.3, time: 300 },
        { ear: 0.15, time: 400 },
        { ear: 0.15, time: 500 },
        { ear: 0.3, time: 600 },
        { ear: 0.3, time: 700 },
      ];

      timeline.forEach((frame) => {
        detector.processFrame(
          createMockResult(frame.ear, frame.ear),
          frame.time
        );
      });

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(2);
    });
  });

  /**
   * Tests Eye Aspect Ratio (EAR) calculations for symmetry and threshold boundaries.
   * 
   * EAR is calculated as: (vertical_dist1 + vertical_dist2) / (2 * horizontal_dist)
   * Default threshold: 0.21 (below = closed, above = open)
   * 
   * These tests verify:
   * - Symmetric eye closure produces matching left/right EAR values
   * - Asymmetric closure (wink, partial blink) is correctly measured
   * - Threshold boundaries are precisely respected (at, just above, just below)
   */
  describe('EAR Symmetry and Threshold Boundaries', () => {
    it('should handle perfectly symmetric eye closure', () => {
      const result = createMockResult(0.2, 0.2);
      detector.processFrame(result);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBeCloseTo(metrics.rightEyeEAR, 2);
      expect(metrics.averageEAR).toBeCloseTo(0.2, 1);
    });

    it('should handle asymmetric eye closure', () => {
      const result = createMockResult(0.35, 0.15);
      detector.processFrame(result);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBeGreaterThan(metrics.rightEyeEAR);
      expect(metrics.averageEAR).toBeCloseTo(0.25, 1);
    });

    it('should not detect blink at exact threshold boundary', () => {
      const openResult = createMockResult(0.22, 0.22);
      detector.processFrame(openResult, 1000);
      detector.processFrame(openResult, 1100);
      const metrics = detector.getMetrics();

      expect(metrics.averageEAR).toBeGreaterThanOrEqual(0.21);
      expect(metrics.blinkCount).toBe(0);
    });

    it('should detect blink just below threshold', () => {
      const result = createMockResult(0.209, 0.209);
      detector.processFrame(result, 1000);
      detector.processFrame(result, 1100);
      const metrics = detector.getMetrics();

      expect(metrics.blinkCount).toBe(1);
    });

    it('should not detect blink just above threshold', () => {
      const result = createMockResult(0.211, 0.211);
      detector.processFrame(result, 1000);
      detector.processFrame(result, 1100);
      const metrics = detector.getMetrics();

      expect(metrics.blinkCount).toBe(0);
    });
  });

  /**
   * Tests consecutive frame logic to prevent false positives.
   * 
   * A blink is only detected after the eyes remain closed for a configured
   * number of consecutive frames (default: 2). This prevents false triggers from:
   * - Quick glances away from screen
   * - Partial eye closures
   * - Single-frame detection errors
   * 
   * These tests verify the system correctly requires sustained closure.
   */
  describe('Consecutive Frame Logic - Edge Cases', () => {
    it('should not trigger false positive for quick glance', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(openResult, 1100);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(0);
    });

    it('should detect blink at exactly configured consecutive frames', () => {
      const customDetector = new BlinkDetector({ consecutiveFrames: 3 });
      const closedResult = createMockResult(0.15, 0.15);

      customDetector.processFrame(closedResult, 1000);
      customDetector.processFrame(closedResult, 1100);
      let metrics = customDetector.getMetrics();
      expect(metrics.blinkCount).toBe(0);

      customDetector.processFrame(closedResult, 1200);
      metrics = customDetector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should not count partial blink sequences', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, 1000);
      detector.processFrame(openResult, 1100);
      detector.processFrame(closedResult, 1200);
      detector.processFrame(openResult, 1300);
      detector.processFrame(closedResult, 1400);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(0);
    });
  });

  /**
   * Tests rolling window for blinks-per-minute calculation and cooldown logic.
   * 
   * Uses Jest fake timers to simulate time passage without actual delays.
   * 
   * Rolling Window:
   * - Maintains last 60 seconds of blink timestamps
   * - Automatically removes blinks older than 60 seconds
   * - Calculates BPM = count of blinks in window
   * 
   * Cooldown (Debounce):
   * - After detecting a blink, requires debounce frames with eyes open
   * - Prevents counting one long blink as multiple blinks
   * - Default: 2 frames with eyes open before next blink can be detected
   */
  describe('Rolling Window and Cooldown Logic with Fake Timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should track blinks within rolling 60-second window using fake timers', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, baseTime);
      detector.processFrame(closedResult, baseTime + 100);
      detector.processFrame(openResult, baseTime + 200);
      detector.processFrame(openResult, baseTime + 300);

      jest.advanceTimersByTime(10000);

      detector.processFrame(closedResult, baseTime + 10000);
      detector.processFrame(closedResult, baseTime + 10100);

      const metrics = detector.getMetrics(baseTime + 10200);
      expect(metrics.blinkCount).toBe(2);
      expect(metrics.blinksPerMinute).toBe(2);
    });

    it('should exclude blinks older than 60 seconds from rolling window', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, baseTime);
      detector.processFrame(closedResult, baseTime + 100);
      detector.processFrame(openResult, baseTime + 200);
      detector.processFrame(openResult, baseTime + 300);

      jest.advanceTimersByTime(65000);

      detector.processFrame(closedResult, baseTime + 65000);
      detector.processFrame(closedResult, baseTime + 65100);

      const metrics = detector.getMetrics(baseTime + 65200);
      expect(metrics.blinkCount).toBe(2);
      expect(metrics.blinksPerMinute).toBe(1);
    });

    it('should enforce cooldown between consecutive blinks', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, baseTime);
      detector.processFrame(closedResult, baseTime + 100);

      detector.processFrame(openResult, baseTime + 200);

      detector.processFrame(closedResult, baseTime + 300);
      detector.processFrame(closedResult, baseTime + 400);

      const metrics = detector.getMetrics(baseTime + 500);
      expect(metrics.blinkCount).toBe(1);
    });

    it('should allow blink detection after proper cooldown period', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, baseTime);
      detector.processFrame(closedResult, baseTime + 100);

      detector.processFrame(openResult, baseTime + 200);
      detector.processFrame(openResult, baseTime + 300);

      detector.processFrame(closedResult, baseTime + 400);
      detector.processFrame(closedResult, baseTime + 500);

      const metrics = detector.getMetrics(baseTime + 600);
      expect(metrics.blinkCount).toBe(2);
    });
  });

  /**
   * Tests various realistic blink patterns that occur in real-world usage.
   * 
   * Uses Jest fake timers to simulate extended time periods.
   * 
   * Patterns tested:
   * 1. No blinks - Sustained attention/concentration (e.g., reading, deep focus)
   *    - Normal: 15-20 blinks/min, Low: <10, None: 0 (screen staring)
   * 
   * 2. Rapid blinks - Stress, eye irritation, fatigue, dry eyes
   *    - Rate: >20 blinks/min, often in bursts
   * 
   * 3. Sustained low rate - Deep focus, screen fatigue, "screen stare"
   *    - Rate: 3-7 blinks/min over extended period
   * 
   * 4. Mixed patterns - Normal daily usage with varying rates
   *    - Transitions between normal, rapid, and slow rates
   * 
   * 5. Burst patterns - Clusters of blinks with long pauses between
   *    - Common after periods of concentration
   */
  describe('Sequence Testing - Various Blink Patterns', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle sequence with no blinks (sustained attention)', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const openResult = createMockResult(0.3, 0.3);

      for (let i = 0; i < 600; i++) {
        detector.processFrame(openResult, baseTime + i * 100);
        jest.advanceTimersByTime(100);
      }

      const metrics = detector.getMetrics(baseTime + 60000);
      expect(metrics.blinkCount).toBe(0);
      expect(metrics.blinksPerMinute).toBe(0);
    });

    it('should handle rapid blink sequence (stress/irritation)', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      let currentTime = baseTime;
      let blinkCount = 0;

      for (let i = 0; i < 20; i++) {
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;

        detector.processFrame(openResult, currentTime);
        currentTime += 100;
        detector.processFrame(openResult, currentTime);
        currentTime += 100;

        jest.advanceTimersByTime(400);
        blinkCount++;
      }

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(blinkCount);
      expect(metrics.blinksPerMinute).toBeGreaterThan(15);
    });

    it('should handle sustained low blink rate (focus/fatigue)', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      let currentTime = baseTime;

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 200; j++) {
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(100);
        }

        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        jest.advanceTimersByTime(200);

        for (let j = 0; j < 20; j++) {
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(100);
        }
      }

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(3);
      expect(metrics.blinksPerMinute).toBeLessThan(5);
    });

    it('should handle mixed pattern - normal to rapid to slow', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      let currentTime = baseTime;

      const simulateBlink = () => {
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        jest.advanceTimersByTime(200);
      };

      const simulateOpenFrames = (count: number) => {
        for (let i = 0; i < count; i++) {
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(100);
        }
      };

      simulateOpenFrames(20);
      simulateBlink();
      simulateOpenFrames(20);
      simulateBlink();

      simulateOpenFrames(10);
      simulateBlink();
      simulateOpenFrames(10);
      simulateBlink();
      simulateOpenFrames(10);
      simulateBlink();

      simulateOpenFrames(100);
      simulateBlink();

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(6);
    });

    it('should handle blink bursts with long pauses', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      let currentTime = baseTime;

      const burstBlinks = (count: number) => {
        for (let i = 0; i < count; i++) {
          detector.processFrame(closedResult, currentTime);
          currentTime += 100;
          detector.processFrame(closedResult, currentTime);
          currentTime += 100;
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(400);
        }
      };

      const longPause = (duration: number) => {
        for (let i = 0; i < duration / 100; i++) {
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(100);
        }
      };

      burstBlinks(5);
      longPause(10000);
      burstBlinks(3);
      longPause(15000);
      burstBlinks(4);

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(12);
    });
  });

  /**
   * Tests error handling and recovery from missing/invalid face landmark data.
   * 
   * In real-world usage, face detection can fail due to:
   * - User looking away from camera
   * - Poor lighting conditions
   * - Temporary occlusions (hand, object passing by)
   * - Processing delays or frame drops
   * 
   * The system must:
   * - Handle missing data gracefully without crashes
   * - Maintain state consistency during detection gaps
   * - Resume normal operation when face detection recovers
   * - Not count false blinks from detection artifacts
   */
  describe('Error Handling and Missing Landmarks', () => {
    it('should gracefully handle null landmarks', () => {
      const result: FaceLandmarkerResult = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      };

      expect(() => detector.processFrame(result)).not.toThrow();
      const metrics = detector.getMetrics();
      expect(metrics.leftEyeEAR).toBe(0);
      expect(metrics.rightEyeEAR).toBe(0);
      expect(metrics.averageEAR).toBe(0);
    });

    it('should handle intermittent face detection failures', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      const emptyResult: FaceLandmarkerResult = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      };

      detector.processFrame(closedResult, 1000);
      detector.processFrame(closedResult, 1100);
      detector.processFrame(emptyResult, 1200);
      detector.processFrame(emptyResult, 1300);
      detector.processFrame(openResult, 1400);
      detector.processFrame(openResult, 1500);
      detector.processFrame(closedResult, 1600);
      detector.processFrame(closedResult, 1700);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(2);
    });

    it('should maintain state when face is lost and resume counting', () => {
      const closedResult = createMockResult(0.15, 0.15);
      const emptyResult: FaceLandmarkerResult = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      };

      detector.processFrame(closedResult, 1000);
      detector.processFrame(emptyResult, 1100);
      detector.processFrame(emptyResult, 1200);
      detector.processFrame(closedResult, 1300);

      const metrics = detector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should recover from multiple consecutive detection failures', () => {
      const openResult = createMockResult(0.3, 0.3);
      const emptyResult: FaceLandmarkerResult = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      };

      for (let i = 0; i < 10; i++) {
        detector.processFrame(emptyResult, i * 100);
      }

      detector.processFrame(openResult, 1000);
      const metrics = detector.getMetrics();

      expect(metrics.leftEyeEAR).toBeGreaterThan(0);
      expect(metrics.rightEyeEAR).toBeGreaterThan(0);
      expect(metrics.blinkCount).toBe(0);
    });
  });

  /**
   * Tests threshold tuning and configuration customization.
   * 
   * The system supports runtime configuration of key parameters:
   * 
   * 1. EAR Threshold (default: 0.21)
   *    - Lower values = stricter detection (only very closed eyes count)
   *    - Higher values = more lenient (partial closures count as blinks)
   *    - Useful for calibration to individual users or lighting conditions
   * 
   * 2. Consecutive Frames (default: 2)
   *    - Number of closed frames required to trigger blink
   *    - Higher = fewer false positives, may miss quick blinks
   *    - Lower = more sensitive, may have false positives
   * 
   * 3. Debounce Frames (default: 2)
   *    - Number of open frames required before next blink can be detected
   *    - Prevents double-counting of single blinks
   *    - Affects maximum detectable blink rate
   * 
   * All parameters can be set at construction or updated at runtime.
   */
  describe('Threshold Tuning and Configuration', () => {
    it('should work correctly with very strict threshold (0.15)', () => {
      const strictDetector = new BlinkDetector({ earThreshold: 0.15 });
      const result = createMockResult(0.16, 0.16);

      strictDetector.processFrame(result, 1000);
      strictDetector.processFrame(result, 1100);

      const metrics = strictDetector.getMetrics();
      expect(metrics.blinkCount).toBe(0);
    });

    it('should work correctly with lenient threshold (0.25)', () => {
      const lenientDetector = new BlinkDetector({ earThreshold: 0.25 });
      const result = createMockResult(0.23, 0.23);

      lenientDetector.processFrame(result, 1000);
      lenientDetector.processFrame(result, 1100);

      const metrics = lenientDetector.getMetrics();
      expect(metrics.blinkCount).toBe(1);
    });

    it('should adapt to custom consecutive frame requirements', () => {
      const detector1 = new BlinkDetector({ consecutiveFrames: 1 });
      const detector3 = new BlinkDetector({ consecutiveFrames: 3 });
      const result = createMockResult(0.15, 0.15);

      detector1.processFrame(result, 1000);
      detector3.processFrame(result, 1000);

      expect(detector1.getMetrics().blinkCount).toBe(1);
      expect(detector3.getMetrics().blinkCount).toBe(0);

      detector3.processFrame(result, 1100);
      detector3.processFrame(result, 1200);
      expect(detector3.getMetrics().blinkCount).toBe(1);
    });

    it('should handle custom debounce configuration', () => {
      const shortDebounce = new BlinkDetector({ debounceFrames: 1 });
      const longDebounce = new BlinkDetector({ debounceFrames: 5 });
      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      shortDebounce.processFrame(closedResult, 1000);
      shortDebounce.processFrame(closedResult, 1100);
      shortDebounce.processFrame(openResult, 1200);
      shortDebounce.processFrame(closedResult, 1300);
      shortDebounce.processFrame(closedResult, 1400);

      longDebounce.processFrame(closedResult, 1000);
      longDebounce.processFrame(closedResult, 1100);
      longDebounce.processFrame(openResult, 1200);
      longDebounce.processFrame(closedResult, 1300);
      longDebounce.processFrame(closedResult, 1400);

      expect(shortDebounce.getMetrics().blinkCount).toBe(2);
      expect(longDebounce.getMetrics().blinkCount).toBe(1);
    });

    it('should allow runtime configuration updates', () => {
      detector.updateConfig({ earThreshold: 0.25 });
      const result = createMockResult(0.23, 0.23);

      detector.processFrame(result, 1000);
      detector.processFrame(result, 1100);

      expect(detector.getMetrics().blinkCount).toBe(1);

      detector.updateConfig({ earThreshold: 0.15 });
      const result2 = createMockResult(0.16, 0.16);

      detector.processFrame(result2, 2000);
      detector.processFrame(result2, 2100);

      expect(detector.getMetrics().blinkCount).toBe(1);
    });

    it('should maintain state correctly across configuration changes', () => {
      const result = createMockResult(0.15, 0.15);

      detector.processFrame(result, 1000);
      detector.updateConfig({ consecutiveFrames: 3 });
      detector.processFrame(result, 1100);

      expect(detector.getMetrics().blinkCount).toBe(0);
    });
  });

  /**
   * Tests blinks-per-minute (BPM) calculation with sliding time windows.
   * 
   * Uses Jest fake timers to simulate time passage and test window sliding behavior.
   * 
   * BPM Calculation:
   * - Maintains timestamps of all blinks in last 60 seconds
   * - BPM = count of blinks within the 60-second window
   * - Window slides continuously as time advances
   * - Old blinks automatically age out of the window
   * 
   * Normal blink rates:
   * - Relaxed: 15-20 blinks/min
   * - Focused: 10-15 blinks/min  
   * - Screen stare: <10 blinks/min (indicates potential eye strain)
   * - Stressed/irritated: >20 blinks/min
   * 
   * These tests verify accurate BPM calculation across various scenarios.
   */
  describe('Blinks Per Minute Calculation with Time Windows', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate accurate BPM for regular blinking pattern', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      let currentTime = baseTime;

      for (let i = 0; i < 15; i++) {
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        jest.advanceTimersByTime(200);

        for (let j = 0; j < 38; j++) {
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(100);
        }
      }

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(15);
      expect(metrics.blinksPerMinute).toBeCloseTo(15, 0);
    });

    it('should handle BPM calculation when window is partially filled', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);
      let currentTime = baseTime;

      for (let i = 0; i < 5; i++) {
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        detector.processFrame(closedResult, currentTime);
        currentTime += 100;
        jest.advanceTimersByTime(200);

        for (let j = 0; j < 18; j++) {
          detector.processFrame(openResult, currentTime);
          currentTime += 100;
          jest.advanceTimersByTime(100);
        }
      }

      const metrics = detector.getMetrics(currentTime);
      expect(metrics.blinkCount).toBe(5);
      expect(metrics.blinksPerMinute).toBe(5);
    });

    it('should slide the time window correctly as time advances', () => {
      const baseTime = 1000000;
      jest.setSystemTime(baseTime);

      const closedResult = createMockResult(0.15, 0.15);
      const openResult = createMockResult(0.3, 0.3);

      detector.processFrame(closedResult, baseTime);
      detector.processFrame(closedResult, baseTime + 100);
      detector.processFrame(openResult, baseTime + 200);
      detector.processFrame(openResult, baseTime + 300);

      jest.advanceTimersByTime(30000);

      detector.processFrame(closedResult, baseTime + 30000);
      detector.processFrame(closedResult, baseTime + 30100);
      detector.processFrame(openResult, baseTime + 30200);

      let metrics = detector.getMetrics(baseTime + 30300);
      expect(metrics.blinksPerMinute).toBe(2);

      jest.advanceTimersByTime(35000);

      metrics = detector.getMetrics(baseTime + 65300);
      expect(metrics.blinksPerMinute).toBe(1);
    });
  });
});
