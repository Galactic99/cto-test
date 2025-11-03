import { createDetectionLoop } from '../src/renderer/sensor/loop';

describe('DetectionLoop', () => {
  let mockTime = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTime = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => mockTime);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('FPS mode configuration', () => {
    it('should set correct FPS for battery mode', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery' });
      const metrics = loop.getMetrics(mockTime);
      expect(metrics.targetFps).toBe(6);
    });

    it('should set correct FPS for balanced mode', () => {
      const loop = createDetectionLoop({ fpsMode: 'balanced' });
      const metrics = loop.getMetrics(mockTime);
      expect(metrics.targetFps).toBe(10);
    });

    it('should set correct FPS for accurate mode', () => {
      const loop = createDetectionLoop({ fpsMode: 'accurate' });
      const metrics = loop.getMetrics(mockTime);
      expect(metrics.targetFps).toBe(15);
    });

    it('should update FPS mode dynamically', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery' });
      let metrics = loop.getMetrics(mockTime);
      expect(metrics.targetFps).toBe(6);

      loop.updateConfig({ fpsMode: 'accurate' });
      metrics = loop.getMetrics(mockTime);
      expect(metrics.targetFps).toBe(15);
    });
  });

  describe('Frame skipping', () => {
    it('should process every frame when skipFrames is 1', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery', skipFrames: 1 });
      const frameInterval = 1000 / 6;

      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
      mockTime += frameInterval;
      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
      mockTime += frameInterval;
      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
    });

    it('should skip every other frame when skipFrames is 2', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery', skipFrames: 2 });
      const frameInterval = 1000 / 6;

      expect(loop.shouldProcessFrame(mockTime)).toBe(false);
      mockTime += frameInterval;
      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
      mockTime += frameInterval;
      expect(loop.shouldProcessFrame(mockTime)).toBe(false);
      mockTime += frameInterval;
      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
    });

    it('should respect FPS interval regardless of skip strategy', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery', skipFrames: 1 });
      const frameInterval = 1000 / 6;

      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
      expect(loop.shouldProcessFrame(mockTime + 50)).toBe(false);
      expect(loop.shouldProcessFrame(mockTime + 100)).toBe(false);
      mockTime += frameInterval;
      expect(loop.shouldProcessFrame(mockTime)).toBe(true);
    });
  });

  describe('Processing time tracking', () => {
    it('should track average processing time', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery' });
      
      loop.recordProcessingTime(0, 10);
      loop.recordProcessingTime(0, 20);
      loop.recordProcessingTime(0, 30);

      const metrics = loop.getMetrics(mockTime);
      expect(metrics.avgProcessingTime).toBe(20);
    });

    it('should calculate CPU usage based on processing time', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery' });
      const frameInterval = 1000 / 6;

      loop.recordProcessingTime(0, frameInterval * 0.05);

      const metrics = loop.getMetrics(mockTime);
      expect(metrics.cpuUsagePercent).toBeCloseTo(5, 1);
    });
  });

  describe('CPU-based throttling', () => {
    it('should not throttle if CPU usage is below threshold', () => {
      const loop = createDetectionLoop({
        fpsMode: 'accurate',
        cpuThreshold: 8,
        cpuMonitorDuration: 1000,
      });

      const frameInterval = 1000 / 15;
      
      for (let i = 0; i < 20; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.05);
        mockTime += frameInterval;
      }

      const metrics = loop.getMetrics(mockTime);
      expect(metrics.isThrottled).toBe(false);
    });

    it('should throttle after sustained high CPU usage', () => {
      const loop = createDetectionLoop({
        fpsMode: 'accurate',
        cpuThreshold: 8,
        cpuMonitorDuration: 100,
      });

      const frameInterval = 1000 / 15;

      for (let i = 0; i < 50; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.15);
        mockTime += frameInterval;
      }

      const metrics = loop.getMetrics(mockTime);
      expect(metrics.isThrottled).toBe(true);
      expect(metrics.cpuUsagePercent).toBeGreaterThan(8);
    });

    it('should log throttle events', () => {
      const loop = createDetectionLoop({
        fpsMode: 'accurate',
        cpuThreshold: 8,
        cpuMonitorDuration: 100,
      });

      const frameInterval = 1000 / 15;

      for (let i = 0; i < 50; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.15);
        mockTime += frameInterval;
      }

      const events = loop.getThrottleEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0]).toHaveProperty('reason');
      expect(events[0]).toHaveProperty('previousFps');
      expect(events[0]).toHaveProperty('newFps');
      expect(events[0]).toHaveProperty('cpuUsage');
    });

    it('should reduce FPS when throttling', () => {
      const loop = createDetectionLoop({
        fpsMode: 'accurate',
        cpuThreshold: 8,
        cpuMonitorDuration: 100,
      });

      const frameInterval = 1000 / 15;

      const metricsBefore = loop.getMetrics(mockTime);
      const initialFps = metricsBefore.targetFps;

      for (let i = 0; i < 50; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.15);
        mockTime += frameInterval;
      }

      const metricsAfter = loop.getMetrics(mockTime);
      if (metricsAfter.isThrottled) {
        const events = loop.getThrottleEvents();
        expect(events[0].newFps).toBeLessThan(initialFps);
      }
    });

    it('should recover from throttling when CPU usage drops', () => {
      const loop = createDetectionLoop({
        fpsMode: 'accurate',
        cpuThreshold: 8,
        cpuMonitorDuration: 100,
      });

      const frameInterval = 1000 / 15;

      for (let i = 0; i < 50; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.15);
        mockTime += frameInterval;
      }

      let metrics = loop.getMetrics(mockTime);
      expect(metrics.isThrottled).toBe(true);

      for (let i = 0; i < 150; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.01);
        mockTime += frameInterval;
      }

      metrics = loop.getMetrics(mockTime);
      expect(metrics.isThrottled).toBe(false);
    });
  });

  describe('Metrics collection', () => {
    it('should track frames processed and skipped', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery', skipFrames: 2 });
      const frameInterval = 1000 / 6;

      let processedCount = 0;
      for (let i = 0; i < 10; i++) {
        if (loop.shouldProcessFrame(mockTime)) {
          loop.recordProcessingTime(mockTime, mockTime + 10);
          processedCount++;
        }
        mockTime += frameInterval;
      }

      const metrics = loop.getMetrics(mockTime);
      expect(metrics.framesProcessed).toBe(processedCount);
      expect(metrics.framesSkipped).toBeGreaterThan(0);
    });

    it('should reset metrics on demand', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery' });

      loop.recordProcessingTime(mockTime, mockTime + 10);
      loop.recordProcessingTime(mockTime, mockTime + 10);

      let metrics = loop.getMetrics(mockTime);
      expect(metrics.framesProcessed).toBe(2);

      loop.resetMetrics();

      metrics = loop.getMetrics(mockTime);
      expect(metrics.framesProcessed).toBe(0);
      expect(metrics.framesSkipped).toBe(0);
    });

    it('should expose throttle reason in metrics when throttled', () => {
      const loop = createDetectionLoop({
        fpsMode: 'accurate',
        cpuThreshold: 8,
        cpuMonitorDuration: 100,
      });

      const frameInterval = 1000 / 15;

      for (let i = 0; i < 50; i++) {
        loop.recordProcessingTime(mockTime, mockTime + frameInterval * 0.15);
        mockTime += frameInterval;
      }

      const metrics = loop.getMetrics(mockTime);
      if (metrics.isThrottled) {
        expect(metrics.throttleReason).toBeDefined();
        expect(typeof metrics.throttleReason).toBe('string');
      }
    });
  });

  describe('Reset functionality', () => {
    it('should reset all internal state', () => {
      const loop = createDetectionLoop({ fpsMode: 'battery' });

      loop.recordProcessingTime(mockTime, mockTime + 10);
      loop.reset();

      const metrics = loop.getMetrics(mockTime);
      expect(metrics.framesProcessed).toBe(0);
      expect(metrics.framesSkipped).toBe(0);
      expect(metrics.avgProcessingTime).toBe(0);
      expect(metrics.cpuUsagePercent).toBe(0);
      expect(metrics.isThrottled).toBe(false);
    });
  });
});
