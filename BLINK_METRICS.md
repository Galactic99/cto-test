# Blink Metrics Implementation

This document describes the blink detection and Eye Aspect Ratio (EAR) metrics implementation for the wellness reminder application.

## Overview

The blink metrics system uses MediaPipe Face Landmarker to detect facial landmarks and compute the Eye Aspect Ratio (EAR) to accurately detect blinks. The system processes video frames in real-time and tracks blink events with configurable thresholds to minimize false positives.

## Architecture

### Components

1. **blink.ts** (`src/renderer/sensor/metrics/blink.ts`)
   - Implements the `BlinkDetector` class for blink detection
   - Calculates Eye Aspect Ratio (EAR) from face landmarks
   - Detects blinks using consecutive frame threshold
   - Tracks blink metrics (count, timestamps, blinks per minute)
   - Provides debouncing to avoid double counting

2. **sensor.ts** (`src/renderer/sensor/sensor.ts`)
   - Integrates blink detector into the camera detection loop
   - Processes frames through the blink detector when enabled
   - Logs blink metrics every 5 seconds for monitoring
   - Manages blink detector lifecycle (initialization, cleanup)

### Eye Aspect Ratio (EAR) Calculation

The EAR is calculated using the formula:

```
EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
```

Where:
- p1, p4 are the horizontal eye corners
- p2, p3, p5, p6 are the vertical eye landmarks

**MediaPipe Face Landmark Indices:**

Left Eye:
- p1 (left corner): 33
- p2 (top): 160
- p3 (top): 158
- p4 (right corner): 133
- p5 (bottom): 153
- p6 (bottom): 144

Right Eye:
- p1 (left corner): 362
- p2 (top): 385
- p3 (top): 387
- p4 (right corner): 263
- p5 (bottom): 373
- p6 (bottom): 380

The average EAR of both eyes is used to determine if eyes are closed.

### Blink Detection Logic

1. **EAR Threshold**: Default 0.21 (eyes considered closed when EAR < threshold)
2. **Consecutive Frames**: Default 2 frames (blink detected after N consecutive frames with low EAR)
3. **Debounce Frames**: Default 2 frames (eyes must be open for N frames before next blink can be detected)

This multi-frame approach minimizes false positives from:
- Rapid eye movements
- Backlight interference
- Temporary face tracking issues
- Partial face occlusion

### Configuration

The blink detector accepts the following configuration parameters:

```typescript
interface BlinkConfig {
  earThreshold: number;        // Default: 0.21
  consecutiveFrames: number;   // Default: 2
  debounceFrames: number;      // Default: 2
}
```

These can be tuned based on:
- Frame rate (10 FPS low, 15 FPS medium, 30 FPS high)
- Individual user characteristics
- Lighting conditions
- Camera quality

## API

### BlinkDetector Class

#### Constructor

```typescript
new BlinkDetector(config?: Partial<BlinkConfig>)
```

Creates a new blink detector with optional custom configuration.

#### Methods

**processFrame(result: FaceLandmarkerResult, timestamp?: number): void**

Processes a single video frame and updates blink detection state.

**getMetrics(currentTime?: number): BlinkMetrics**

Returns current blink metrics:
```typescript
interface BlinkMetrics {
  blinkCount: number;
  leftEyeEAR: number;
  rightEyeEAR: number;
  averageEAR: number;
  lastBlinkTimestamp: number | null;
  blinksPerMinute: number;
}
```

**reset(): void**

Resets all metrics and detection state to initial values.

**updateConfig(config: Partial<BlinkConfig>): void**

Updates the detector configuration without resetting state.

**getConfig(): BlinkConfig**

Returns the current detector configuration.

### Factory Function

```typescript
createBlinkDetector(config?: Partial<BlinkConfig>): BlinkDetector
```

Factory function to create a new blink detector instance.

## Integration

### Sensor Window

The blink detector is integrated into the sensor window's detection loop:

1. **Initialization**: Created when camera starts and model loads
2. **Processing**: Processes each frame after warmup completes (if blink detection is enabled)
3. **Logging**: Metrics logged every 5 seconds along with performance stats
4. **Cleanup**: Reset and released when camera stops

### Access Metrics

Blink metrics can be accessed via the global window function:

```typescript
const metrics = window.getBlinkMetrics();
if (metrics) {
  console.log('Blink count:', metrics.blinkCount);
  console.log('Blinks per minute:', metrics.blinksPerMinute);
  console.log('Average EAR:', metrics.averageEAR);
}
```

## Performance

- **CPU Impact**: Minimal (~0.1-0.5% additional overhead)
- **Memory**: ~10KB for state and history
- **Latency**: Real-time processing with no noticeable delay

The blink detection runs after face landmark detection is complete, adding negligible overhead to the existing detection pipeline.

## Testing

### Unit Tests

Comprehensive unit tests are provided in `tests/blinkMetrics.test.ts`:

- EAR calculation accuracy
- Blink detection logic with consecutive frames
- Debouncing to prevent double counting
- Configuration management
- Blinks per minute calculation
- Edge cases (rapid movements, long blinks, missing face)
- Frame sequence simulation at various FPS rates

Run tests:
```bash
npm test -- blinkMetrics.test.ts
```

### Manual Testing

To manually test blink detection:

1. Start the application
2. Enable camera in settings
3. Enable blink detection feature
4. Open sensor window console
5. Perform natural blinks
6. Observe console logs every 5 seconds showing:
   - Blink count
   - Blinks per minute
   - Average EAR

Expected behavior:
- Natural blinks increment counter by 1
- Rapid blinks are debounced appropriately
- Eye movements do not trigger false positives
- EAR values are stable when eyes are open (~0.25-0.35)
- EAR values drop significantly when eyes are closed (~0.10-0.15)

## Metrics

### Blink Count
Total number of blinks detected since detection started or last reset.

### Blinks Per Minute
Rolling calculation based on blinks in the last 60 seconds. Useful for:
- Health monitoring (normal rate: 15-20 blinks/min)
- Fatigue detection (decreased rate indicates strain)
- Alert timing (trigger reminder after extended low blink rate)

### Eye Aspect Ratio (EAR)
Current EAR for left eye, right eye, and average. Useful for:
- Debugging detection accuracy
- Tuning threshold values
- Identifying lighting or tracking issues
- Distinguishing blinks from other eye movements

### Last Blink Timestamp
Timestamp of the most recent detected blink. Useful for:
- Calculating time since last blink
- Triggering time-based alerts
- Synchronizing with other metrics

## Future Enhancements

- **Adaptive Thresholds**: Automatically adjust EAR threshold based on user's baseline
- **Blink Duration**: Track how long each blink lasts (detect microsleeps)
- **Blink Pattern Analysis**: Identify abnormal patterns that indicate fatigue
- **Machine Learning**: Use ML model to improve detection accuracy
- **Real-time Notifications**: Send alerts when blink rate is too low
- **Historical Data**: Store blink metrics over time for trends analysis
- **Calibration Mode**: Interactive calibration to set personalized thresholds

## References

- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
- [Eye Aspect Ratio for Blink Detection](http://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf)
- [Soukupová, T. & Čech, J. (2016). Real-Time Eye Blink Detection using Facial Landmarks](https://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf)
