# Sensor Metrics

This directory contains metric processors for the sensor pipeline. Each metric module processes face landmark data from MediaPipe and extracts specific health/wellness indicators.

## Available Metrics

### Blink Detection (`blink.ts`)

Detects eye blinks using Eye Aspect Ratio (EAR) calculation from face landmarks.

**Features:**
- Real-time blink detection with configurable thresholds
- Consecutive frame requirement to reduce false positives
- Debouncing to prevent double counting
- Blinks per minute calculation with rolling window
- Per-eye and average EAR tracking

**Usage:**
```typescript
import { createBlinkDetector } from './metrics/blink';

const detector = createBlinkDetector({
  earThreshold: 0.21,
  consecutiveFrames: 2,
  debounceFrames: 2,
});

// In detection loop
const result = faceLandmarker.detect(video);
detector.processFrame(result, Date.now());

// Get metrics
const metrics = detector.getMetrics();
console.log('Blinks:', metrics.blinkCount);
console.log('BPM:', metrics.blinksPerMinute);
```

**Configuration:**
- `earThreshold`: EAR value below which eyes are considered closed (default: 0.21)
- `consecutiveFrames`: Number of consecutive frames needed to detect a blink (default: 2)
- `debounceFrames`: Number of frames eyes must be open before next blink (default: 2)

## Adding New Metrics

To add a new metric processor:

1. Create a new file (e.g., `posture.ts`)
2. Implement a detector class with:
   - `processFrame(result: FaceLandmarkerResult, timestamp?: number): void`
   - `getMetrics(): YourMetrics`
   - `reset(): void`
   - Optional: `updateConfig(config: YourConfig): void`
3. Export a factory function (e.g., `createPostureDetector()`)
4. Add unit tests in `tests/yourMetric.test.ts`
5. Integrate into `sensor.ts` detection loop
6. Update documentation

## Testing

Each metric should have comprehensive unit tests covering:
- Configuration management
- Metric calculation accuracy
- State management (initialization, reset)
- Edge cases (missing data, rapid changes, etc.)
- Frame sequence simulation

Run tests:
```bash
npm test -- metrics
```

## Performance Considerations

- Keep processing lightweight (target < 1ms per frame)
- Use efficient data structures for history tracking
- Clean up old data regularly (e.g., rolling windows)
- Avoid complex calculations in hot paths
- Consider caching frequently used values

## Integration with Sensor Pipeline

Metrics are integrated into the sensor detection loop in `sensor.ts`:

1. Initialize detector when model loads
2. Process each frame after warmup completes
3. Check if feature is enabled in config
4. Call `processFrame()` with detection results
5. Log metrics periodically (every 5 seconds)
6. Clean up on camera stop

Example integration:
```typescript
// In sensor.ts
let blinkDetector: BlinkDetector | null = null;

// Initialize
blinkDetector = createBlinkDetector();

// Process
if (detectionConfig?.features.blink && blinkDetector) {
  blinkDetector.processFrame(result, now);
}

// Cleanup
if (blinkDetector) {
  blinkDetector.reset();
  blinkDetector = null;
}
```
