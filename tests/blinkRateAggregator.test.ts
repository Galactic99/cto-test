import {
  BlinkRateAggregator,
  createBlinkRateAggregator,
} from '../src/renderer/sensor/metrics/aggregators';

describe('BlinkRateAggregator', () => {
  let aggregator: BlinkRateAggregator;

  beforeEach(() => {
    aggregator = new BlinkRateAggregator(3);
  });

  describe('createBlinkRateAggregator', () => {
    it('should create an aggregator with default window', () => {
      const agg = createBlinkRateAggregator();
      expect(agg).toBeInstanceOf(BlinkRateAggregator);
    });

    it('should create an aggregator with custom window', () => {
      const agg = createBlinkRateAggregator(5);
      expect(agg).toBeInstanceOf(BlinkRateAggregator);
      const metrics = agg.getMetrics();
      expect(metrics.windowDurationMs).toBe(5 * 60 * 1000);
    });
  });

  describe('addEvent', () => {
    it('should add events to the aggregator', () => {
      const timestamp = Date.now();
      aggregator.addEvent(timestamp);
      expect(aggregator.getEventCount()).toBe(1);
    });

    it('should accumulate multiple events', () => {
      const baseTime = Date.now();
      aggregator.addEvent(baseTime);
      aggregator.addEvent(baseTime + 1000);
      aggregator.addEvent(baseTime + 2000);
      expect(aggregator.getEventCount()).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('should return zero bpm with no events', () => {
      const metrics = aggregator.getMetrics();
      expect(metrics.blinksPerMinute).toBe(0);
      expect(metrics.eventCount).toBe(0);
    });

    it('should calculate bpm for a single event', () => {
      const currentTime = Date.now();
      const eventTime = currentTime - 30000; // 30 seconds ago
      aggregator.addEvent(eventTime);
      
      const metrics = aggregator.getMetrics(currentTime);
      // 1 blink in 0.5 minutes = 2 bpm
      expect(metrics.blinksPerMinute).toBeCloseTo(2, 1);
      expect(metrics.eventCount).toBe(1);
    });

    it('should calculate bpm correctly over 1 minute', () => {
      const currentTime = Date.now();
      const startTime = currentTime - 60000; // 1 minute ago
      
      // Add 10 blinks over 1 minute
      for (let i = 0; i < 10; i++) {
        aggregator.addEvent(startTime + i * 6000);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.blinksPerMinute).toBeCloseTo(10, 0);
      expect(metrics.eventCount).toBe(10);
    });

    it('should calculate bpm correctly over 2 minutes', () => {
      const currentTime = Date.now();
      const startTime = currentTime - 120000; // 2 minutes ago
      
      // Add 20 blinks over 2 minutes (10 bpm)
      for (let i = 0; i < 20; i++) {
        aggregator.addEvent(startTime + i * 6000);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.blinksPerMinute).toBeCloseTo(10, 0);
      expect(metrics.eventCount).toBe(20);
    });

    it('should calculate bpm correctly over 3 minutes', () => {
      const currentTime = Date.now();
      const startTime = currentTime - 180000 + 1000; // Just inside 3 minute window
      
      // Add 27 blinks over ~3 minutes (9 bpm)
      for (let i = 0; i < 27; i++) {
        aggregator.addEvent(startTime + i * 6666);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.blinksPerMinute).toBeCloseTo(9, 0);
      expect(metrics.eventCount).toBe(27);
    });

    it('should handle irregular blink patterns', () => {
      const currentTime = Date.now();
      
      // Add blinks at irregular intervals
      aggregator.addEvent(currentTime - 120000); // 2 min ago
      aggregator.addEvent(currentTime - 110000);
      aggregator.addEvent(currentTime - 90000);
      aggregator.addEvent(currentTime - 60000); // 1 min ago
      aggregator.addEvent(currentTime - 30000);
      aggregator.addEvent(currentTime - 10000);
      
      const metrics = aggregator.getMetrics(currentTime);
      // 6 blinks over 2 minutes = 3 bpm
      expect(metrics.blinksPerMinute).toBeCloseTo(3, 0);
      expect(metrics.eventCount).toBe(6);
    });
  });

  describe('cleanup old events', () => {
    it('should remove events older than window duration', () => {
      const currentTime = Date.now();
      const windowMs = 3 * 60 * 1000; // 3 minutes
      
      // Add events: some old, some within window
      aggregator.addEvent(currentTime - windowMs - 10000); // Too old
      aggregator.addEvent(currentTime - windowMs + 10000); // Within window
      aggregator.addEvent(currentTime - 60000); // Within window
      aggregator.addEvent(currentTime - 30000); // Within window
      
      const metrics = aggregator.getMetrics(currentTime);
      // Only 3 events should remain (the one too old is dropped)
      expect(metrics.eventCount).toBe(3);
    });

    it('should cleanup events when adding new events', () => {
      const baseTime = Date.now();
      const windowMs = 3 * 60 * 1000;
      
      // Add old event
      aggregator.addEvent(baseTime - windowMs - 10000);
      expect(aggregator.getEventCount()).toBe(1);
      
      // Add new event, should trigger cleanup
      aggregator.addEvent(baseTime);
      expect(aggregator.getEventCount()).toBe(1); // Old one removed
    });

    it('should maintain accurate bpm after cleanup', () => {
      const currentTime = Date.now();
      const windowMs = 3 * 60 * 1000;
      
      // Add many old events
      for (let i = 0; i < 10; i++) {
        aggregator.addEvent(currentTime - windowMs - 60000 + i * 1000);
      }
      
      // Add recent events (9 bpm)
      for (let i = 0; i < 9; i++) {
        aggregator.addEvent(currentTime - 60000 + i * 6666);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.eventCount).toBe(9); // Old events cleaned up
      expect(metrics.blinksPerMinute).toBeCloseTo(9, 0);
    });
  });

  describe('reset', () => {
    it('should clear all events', () => {
      const currentTime = Date.now();
      aggregator.addEvent(currentTime - 60000);
      aggregator.addEvent(currentTime - 30000);
      aggregator.addEvent(currentTime - 10000);
      
      expect(aggregator.getEventCount()).toBe(3);
      
      aggregator.reset();
      
      expect(aggregator.getEventCount()).toBe(0);
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.blinksPerMinute).toBe(0);
      expect(metrics.eventCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle events at exact window boundary', () => {
      const currentTime = Date.now();
      const windowMs = 3 * 60 * 1000;
      
      // Event exactly at window edge
      aggregator.addEvent(currentTime - windowMs);
      
      const metrics = aggregator.getMetrics(currentTime);
      // Event at exact boundary should be excluded (> not >=)
      expect(metrics.eventCount).toBe(0);
    });

    it('should handle rapid succession of events', () => {
      const currentTime = Date.now();
      
      // Add many events in quick succession
      for (let i = 0; i < 100; i++) {
        aggregator.addEvent(currentTime - 1000 + i * 10);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.eventCount).toBe(100);
      // 100 blinks in ~1 second = very high rate
      expect(metrics.blinksPerMinute).toBeGreaterThan(1000);
    });

    it('should handle sparse events over long window', () => {
      const currentTime = Date.now();
      
      // Only 2 events spread over 3 minutes
      aggregator.addEvent(currentTime - 179000); // Just inside window
      aggregator.addEvent(currentTime - 1000); // Near end
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.eventCount).toBe(2);
      // 2 blinks over ~3 minutes ≈ 0.67 bpm
      expect(metrics.blinksPerMinute).toBeCloseTo(0.67, 1);
    });
  });

  describe('multi-minute tracking', () => {
    it('should track events accurately over full window duration', () => {
      const currentTime = Date.now();
      const startTime = currentTime - 179000; // Just under 3 minutes ago
      
      // Consistent 10 bpm for ~3 minutes = 30 blinks
      for (let i = 0; i < 30; i++) {
        aggregator.addEvent(startTime + i * 6000);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.eventCount).toBe(30);
      expect(metrics.blinksPerMinute).toBeCloseTo(10, 0);
    });

    it('should handle varying rates within window', () => {
      const currentTime = Date.now();
      
      // High rate for first minute (20 bpm)
      for (let i = 0; i < 20; i++) {
        aggregator.addEvent(currentTime - 179000 + i * 3000);
      }
      
      // Low rate for second minute (5 bpm)
      for (let i = 0; i < 5; i++) {
        aggregator.addEvent(currentTime - 119000 + i * 12000);
      }
      
      // Medium rate for third minute (10 bpm)
      for (let i = 0; i < 10; i++) {
        aggregator.addEvent(currentTime - 59000 + i * 6000);
      }
      
      const metrics = aggregator.getMetrics(currentTime);
      expect(metrics.eventCount).toBe(35);
      // Average: (20 + 5 + 10) / 3 ≈ 11.67 bpm
      expect(metrics.blinksPerMinute).toBeCloseTo(11.67, 0);
    });
  });

  describe('window size configuration', () => {
    it('should respect custom window size', () => {
      const customAgg = new BlinkRateAggregator(2); // 2 minute window
      const currentTime = Date.now();
      
      // Add events at 1 and 2.5 minutes ago
      customAgg.addEvent(currentTime - 60000);
      customAgg.addEvent(currentTime - 150000);
      
      const metrics = customAgg.getMetrics(currentTime);
      // Event at 2.5 min is outside 2-min window
      expect(metrics.eventCount).toBe(1);
      expect(metrics.windowDurationMs).toBe(2 * 60 * 1000);
    });

    it('should support 2-minute window', () => {
      const agg2min = new BlinkRateAggregator(2);
      const currentTime = Date.now();
      
      // Add 20 blinks over 2 minutes (10 bpm)
      for (let i = 0; i < 20; i++) {
        aggregator.addEvent(currentTime - 120000 + i * 6000);
      }
      
      const metrics = agg2min.getMetrics(currentTime);
      expect(metrics.windowDurationMs).toBe(2 * 60 * 1000);
    });
  });
});
