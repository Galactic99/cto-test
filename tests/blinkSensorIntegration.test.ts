import { BlinkDetector, createBlinkDetector } from '../src/renderer/sensor/metrics/blink';

describe('Blink Sensor Integration', () => {
  let detector: BlinkDetector;

  beforeEach(() => {
    detector = createBlinkDetector();
  });

  it('should create detector without errors', () => {
    expect(detector).toBeDefined();
    expect(detector.getConfig).toBeDefined();
    expect(detector.processFrame).toBeDefined();
    expect(detector.getMetrics).toBeDefined();
    expect(detector.reset).toBeDefined();
  });

  it('should work with default configuration optimized for 10 FPS', () => {
    const config = detector.getConfig();
    expect(config.earThreshold).toBe(0.21);
    expect(config.consecutiveFrames).toBe(2);
    expect(config.debounceFrames).toBe(2);
  });

  it('should handle null/undefined face landmarks gracefully', () => {
    const emptyResult: any = {
      faceLandmarks: [],
      faceBlendshapes: [],
      facialTransformationMatrixes: [],
    };

    expect(() => detector.processFrame(emptyResult)).not.toThrow();
    const metrics = detector.getMetrics();
    expect(metrics.blinkCount).toBe(0);
  });

  it('should integrate with sensor detection loop pattern', () => {
    let detectionConfig = { features: { blink: true, posture: false }, fpsMode: 'low' as const };
    let blinkDetector: BlinkDetector | null = null;
    let warmupFramesProcessed = 5;

    if (!blinkDetector) {
      blinkDetector = createBlinkDetector();
    }

    const mockResult: any = {
      faceLandmarks: [[
        { x: 0.3, y: 0.5, z: 0, visibility: 1 },
      ]],
      faceBlendshapes: [],
      facialTransformationMatrixes: [],
    };

    if (detectionConfig?.features.blink && blinkDetector && warmupFramesProcessed >= 5) {
      expect(() => blinkDetector.processFrame(mockResult, Date.now())).not.toThrow();
    }

    const metrics = blinkDetector.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.blinkCount).toBeGreaterThanOrEqual(0);
  });

  it('should expose metrics via getMetrics API', () => {
    const metrics = detector.getMetrics();

    expect(metrics).toHaveProperty('blinkCount');
    expect(metrics).toHaveProperty('leftEyeEAR');
    expect(metrics).toHaveProperty('rightEyeEAR');
    expect(metrics).toHaveProperty('averageEAR');
    expect(metrics).toHaveProperty('lastBlinkTimestamp');
    expect(metrics).toHaveProperty('blinksPerMinute');

    expect(typeof metrics.blinkCount).toBe('number');
    expect(typeof metrics.leftEyeEAR).toBe('number');
    expect(typeof metrics.rightEyeEAR).toBe('number');
    expect(typeof metrics.averageEAR).toBe('number');
    expect(typeof metrics.blinksPerMinute).toBe('number');
  });

  it('should reset state when camera stops', () => {
    const mockResult: any = {
      faceLandmarks: [[
        { x: 0.3, y: 0.5, z: 0, visibility: 1 },
      ]],
      faceBlendshapes: [],
      facialTransformationMatrixes: [],
    };

    detector.processFrame(mockResult, 1000);

    detector.reset();

    const metrics = detector.getMetrics();
    expect(metrics.blinkCount).toBe(0);
    expect(metrics.leftEyeEAR).toBe(0);
    expect(metrics.rightEyeEAR).toBe(0);
    expect(metrics.lastBlinkTimestamp).toBeNull();
  });

  it('should be configurable for different FPS modes', () => {
    const lowFpsDetector = createBlinkDetector({
      consecutiveFrames: 2,
    });

    const mediumFpsDetector = createBlinkDetector({
      consecutiveFrames: 3,
    });

    const highFpsDetector = createBlinkDetector({
      consecutiveFrames: 4,
    });

    expect(lowFpsDetector.getConfig().consecutiveFrames).toBe(2);
    expect(mediumFpsDetector.getConfig().consecutiveFrames).toBe(3);
    expect(highFpsDetector.getConfig().consecutiveFrames).toBe(4);
  });
});
