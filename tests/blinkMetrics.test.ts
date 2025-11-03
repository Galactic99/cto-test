import {
  BlinkDetector,
  createBlinkDetector,
  BlinkConfig,
} from '../src/renderer/sensor/metrics/blink';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

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
});
