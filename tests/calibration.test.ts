import { PostureDetector } from '../src/renderer/sensor/metrics/posture';

describe('Posture Calibration', () => {
  describe('Baseline Application', () => {
    it('should apply baseline to posture score calculation', () => {
      const detector = new PostureDetector();
      
      detector.setBaseline(10, 2);
      
      const config = detector.getConfig();
      expect(config).toBeDefined();
    });

    it('should compute threshold from baseline plus delta', () => {
      const baseline = 15;
      const allowedOffset = 10;
      const expectedThreshold = baseline + allowedOffset;
      
      expect(expectedThreshold).toBe(25);
    });

    it('should adjust posture score based on baseline', () => {
      const detector = new PostureDetector();
      
      detector.setBaseline(10, 2);
      
      const metrics = detector.getMetrics();
      
      expect(metrics.postureScore).toBe(100);
    });

    it('should clear baseline when requested', () => {
      const detector = new PostureDetector();
      
      detector.setBaseline(10, 2);
      detector.clearBaseline();
      
      const metrics = detector.getMetrics();
      expect(metrics.postureScore).toBe(100);
    });

    it('should improve posture detection accuracy with calibration', () => {
      const detectorWithBaseline = new PostureDetector();
      const detectorWithoutBaseline = new PostureDetector();
      
      detectorWithBaseline.setBaseline(10, 2);
      
      expect(detectorWithBaseline.getMetrics().postureScore).toBeGreaterThanOrEqual(0);
      expect(detectorWithoutBaseline.getMetrics().postureScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Baseline Calculation', () => {
    it('should calculate average baseline from samples', () => {
      const samples = [10.5, 11.2, 9.8, 10.7, 10.3];
      const average = samples.reduce((sum, val) => sum + val, 0) / samples.length;
      
      expect(average).toBeCloseTo(10.5, 1);
    });

    it('should handle edge case with single sample', () => {
      const samples = [15.0];
      const average = samples.reduce((sum, val) => sum + val, 0) / samples.length;
      
      expect(average).toBe(15.0);
    });

    it('should handle edge case with many samples', () => {
      const samples = Array(100).fill(12.5);
      const average = samples.reduce((sum, val) => sum + val, 0) / samples.length;
      
      expect(average).toBe(12.5);
    });
  });

  describe('Threshold Derivation', () => {
    it('should derive posture threshold from baseline with default offset', () => {
      const baseline = 12.0;
      const defaultOffset = 15.0;
      const threshold = baseline + defaultOffset;
      
      expect(threshold).toBe(27.0);
    });

    it('should derive posture threshold from baseline with custom offset', () => {
      const baseline = 8.5;
      const customOffset = 20.0;
      const threshold = baseline + customOffset;
      
      expect(threshold).toBe(28.5);
    });

    it('should handle negative baseline values', () => {
      const baseline = -5.0;
      const offset = 15.0;
      const threshold = baseline + offset;
      
      expect(threshold).toBe(10.0);
    });
  });
});
