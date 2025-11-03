# Detection Loop Performance Tuning Implementation

## Overview

This implementation adds intelligent FPS throttling and CPU monitoring to the detection loop, ensuring the application meets CPU performance targets while maintaining accurate detection.

## Architecture

### Detection Loop (`src/renderer/sensor/loop.ts`)

The `DetectionLoop` class manages frame processing rate and automatically adjusts based on CPU load:

**Key Features:**
- **FPS Modes**: Three processing modes with different frame rates
  - Battery: 6 FPS - Minimal CPU usage
  - Balanced: 10 FPS - Default mode
  - Accurate: 15 FPS - Higher accuracy

- **Frame Skipping**: Configurable strategy to skip every N frames
  - Default: Process every frame (skipFrames = 1)
  - Can be configured to skip frames for further CPU reduction

- **CPU Monitoring**: Real-time CPU usage tracking
  - Samples processing time vs frame interval
  - Maintains moving average of CPU usage
  - Triggers auto-throttling when needed

- **Auto-Throttling**: Automatic FPS reduction under sustained load
  - Monitors if CPU usage > 8% (configurable threshold)
  - Triggers after 10 seconds (configurable duration) of high usage
  - Reduces FPS by 30% (down to minimum 6 FPS)
  - Logs throttling events with reason and metrics
  - Auto-recovers when CPU usage drops below 4% (50% of threshold)

### Integration (`src/renderer/sensor/sensor.ts`)

The sensor window integrates the DetectionLoop for frame processing:

1. Creates DetectionLoop instance with current FPS mode
2. Calls `shouldProcessFrame()` to check if frame should be processed
3. Records processing time after each frame
4. Reports loop metrics (FPS, CPU usage, throttle status) to main process
5. Exposes metrics for UI diagnostics

### UI Updates (`src/renderer/components/DetectionSettings.tsx`)

FPS mode selector updated to reflect new modes:
- Battery saver (6 FPS)
- Balanced (10 FPS) - Default
- Accurate (15 FPS)

## Metrics Exposed

The detection loop exposes the following metrics via `getMetrics()`:

```typescript
interface LoopMetrics {
  currentFps: number;           // Actual FPS achieved
  targetFps: number;            // Target FPS for current mode
  avgProcessingTime: number;    // Average processing time per frame (ms)
  cpuUsagePercent: number;      // Estimated CPU usage percentage
  framesProcessed: number;      // Total frames processed
  framesSkipped: number;        // Total frames skipped
  isThrottled: boolean;         // Whether auto-throttling is active
  throttleReason?: string;      // Reason for throttling (if active)
}
```

These metrics are sent to the main process every 5 seconds and included in IPC messages for UI diagnostics.

## Throttling Events

All throttling events are logged and can be retrieved via `getThrottleEvents()`:

```typescript
interface ThrottleEvent {
  timestamp: number;      // When throttling occurred
  reason: string;         // Description of why throttling occurred
  previousFps: number;    // FPS before throttling
  newFps: number;         // FPS after throttling
  cpuUsage: number;       // CPU usage that triggered throttling
}
```

## Usage Example

```typescript
// Create detection loop with balanced mode
const loop = createDetectionLoop({
  fpsMode: 'balanced',
  skipFrames: 1,
  cpuThreshold: 8,           // Optional: default 8%
  cpuMonitorDuration: 10000  // Optional: default 10s
});

// In requestAnimationFrame loop
function detectFrame() {
  const now = performance.now();
  
  // Check if frame should be processed
  if (!loop.shouldProcessFrame(now)) {
    requestAnimationFrame(detectFrame);
    return;
  }
  
  const startTime = performance.now();
  
  // Process detection...
  const result = model.detect(video);
  
  const endTime = performance.now();
  
  // Record processing time for CPU monitoring
  loop.recordProcessingTime(startTime, endTime);
  
  // Get metrics periodically
  const metrics = loop.getMetrics(now);
  console.log(`FPS: ${metrics.currentFps}, CPU: ${metrics.cpuUsagePercent}%`);
  
  if (metrics.isThrottled) {
    console.warn(`Throttled: ${metrics.throttleReason}`);
  }
  
  requestAnimationFrame(detectFrame);
}
```

## Testing

Unit tests in `tests/loop.test.ts` cover:
- FPS mode configuration and dynamic updates
- Frame skipping strategies
- Processing time tracking and CPU calculation
- Auto-throttling under sustained load
- Throttle event logging
- Recovery from throttling
- Metrics collection and reset
- State reset functionality

Run tests with: `npm test -- loop.test.ts`

## Performance Targets

- **Target CPU Usage**: < 8% sustained during active detection
- **Auto-Throttle Trigger**: CPU > 8% for 10 seconds
- **Auto-Recovery**: CPU < 4% (50% of threshold)
- **Minimum FPS**: 6 FPS (Battery mode)
- **Maximum FPS**: 15 FPS (Accurate mode)

## Configuration

All thresholds can be configured when creating the DetectionLoop:

```typescript
const loop = createDetectionLoop({
  fpsMode: 'balanced',       // 'battery' | 'balanced' | 'accurate'
  skipFrames: 1,             // Process every N frames
  cpuThreshold: 8,           // CPU % threshold for throttling
  cpuMonitorDuration: 10000  // Duration (ms) of high CPU before throttling
});
```

Configuration can be updated dynamically:

```typescript
loop.updateConfig({
  fpsMode: 'battery',        // Switch to battery mode
  cpuThreshold: 6            // Lower threshold
});
```

## Future Enhancements

Potential improvements:
- Web Worker integration for true background processing
- GPU acceleration monitoring
- Adaptive FPS based on detection confidence
- Per-feature CPU usage breakdown
- Battery level integration for mobile devices
