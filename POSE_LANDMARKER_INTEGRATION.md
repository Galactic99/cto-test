# Pose Landmarker Integration

This document describes the MediaPipe Pose Landmarker integration for posture detection.

## Overview

The Pose Landmarker model is integrated into the sensor window to provide real-time upper-body pose landmark detection for posture monitoring.

## Architecture

### Components

1. **poseLandmarker.ts** (`src/renderer/sensor/models/poseLandmarker.ts`)
   - Lazy-loads the MediaPipe Pose Landmarker model (lite/upper-body mode)
   - Manages model lifecycle (initialization, inference, cleanup)
   - Implements GPU preference with CPU fallback
   - Provides singleton pattern for efficient resource usage

2. **sensor.ts** (`src/renderer/sensor/sensor.ts`)
   - Integrates Pose Landmarker into camera lifecycle
   - Runs detection loop at configurable FPS (8-10 FPS target for posture)
   - Handles warmup frames for model stabilization
   - Logs performance metrics for monitoring
   - Supports parallel detection with Face Landmarker

### Model Loading

The Pose Landmarker uses lazy loading to avoid blocking the UI:
- Model is loaded when camera starts and posture detection is enabled
- WASM files are bundled with the application for offline use
- GPU delegate is preferred, with automatic CPU fallback
- Initialization time is logged for performance monitoring
- Uses the "lite" variant optimized for upper-body tracking

### Asset Bundling

WASM assets are automatically copied during build:
- Source: `node_modules/@mediapipe/tasks-vision/wasm`
- Destination: `dist-electron/renderer/wasm`
- Files: `vision_wasm_internal.{js,wasm}` and `vision_wasm_nosimd_internal.{js,wasm}`

### Detection Loop

The detection loop runs at configurable FPS:
- **Low**: 10 FPS (~8% CPU) - recommended for posture detection
- **Medium**: 15 FPS (~10% CPU)
- **High**: 30 FPS (~15% CPU)

Performance metrics are logged every 5 seconds:
- Actual FPS achieved
- Target FPS
- Estimated CPU usage
- Landmark count when detected

### Warmup Frames

The model processes 5 warmup frames before considering itself ready:
- Allows model to stabilize
- Improves inference accuracy
- Logged when complete: "Warmup complete, pose model ready for detection"

## API

### initializePoseLandmarker(options?)

Initializes and returns a Pose Landmarker instance.

**Options:**
- `minPoseDetectionConfidence`: Minimum confidence for pose detection (default: 0.5)
- `minPosePresenceConfidence`: Minimum confidence for pose presence (default: 0.5)
- `minTrackingConfidence`: Minimum confidence for pose tracking (default: 0.5)
- `preferGpu`: Whether to prefer GPU delegate (default: true)

**Returns:**
```typescript
{
  detect: (video: HTMLVideoElement) => PoseLandmarkerResult | null;
  close: () => void;
}
```

### closePoseLandmarker()

Closes the Pose Landmarker instance and releases resources.

### isPoseLandmarkerInitialized()

Returns whether the Pose Landmarker is currently initialized.

### isPoseLandmarkerInitializing()

Returns whether the Pose Landmarker is currently initializing.

## Usage Example

```typescript
import { initializePoseLandmarker, closePoseLandmarker } from './models/poseLandmarker';

// Initialize
const landmarker = await initializePoseLandmarker({
  preferGpu: true,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

// Detect pose
const video = document.getElementById('video') as HTMLVideoElement;
const result = landmarker.detect(video);

if (result && result.landmarks && result.landmarks.length > 0) {
  console.log('Detected pose landmarks:', result.landmarks[0].length, 'landmarks');
  // Upper-body landmarks typically include:
  // - Face (nose, eyes, ears)
  // - Shoulders
  // - Elbows
  // - Wrists
}

// Cleanup
closePoseLandmarker();
```

## Resource Cleanup

Resources are automatically cleaned up in the following scenarios:
- Detection stop: `stopCamera()` calls `cleanupModel()`
- Window unload: `beforeunload` event handler calls cleanup
- Manual cleanup: Call `closePoseLandmarker()` directly

## Performance Monitoring

Performance is monitored via console logs:
- Model initialization time
- Detection FPS (every 5 seconds)
- Estimated CPU usage
- Warmup completion
- Landmark detection count

Example logs:
```
[PoseLandmarker] Initializing Pose Landmarker...
[PoseLandmarker] Pose Landmarker initialized successfully with GPU delegate in 142.33ms
[Sensor] Pose Landmarker ready for detection
[Sensor] Warmup complete, pose model ready for detection
[Sensor] Pose landmarks detected: 33 landmarks
[Sensor] Performance: 9.60 FPS (target: 10), ~4.80% estimated CPU usage
```

## Model Details

- **Model**: MediaPipe Pose Landmarker Lite
- **Variant**: Upper-body optimized
- **URL**: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- **Landmarks**: 33 pose landmarks (subset tracked in upper-body mode)
- **Running Mode**: VIDEO (optimized for video streams)

## Parallel Detection

The pose landmarker can run in parallel with the face landmarker:
- Both models share the same video stream
- Detection is coordinated in the same frame loop
- Each model can be independently enabled/disabled via `detectionConfig.features`
- Resources are independently managed and cleaned up

## Testing

Unit tests are provided in `tests/poseLandmarker.test.ts`:
- Model initialization (GPU/CPU)
- Resource cleanup
- Error handling
- Concurrent initialization
- Detection with valid/invalid video

Run tests:
```bash
npm test -- poseLandmarker.test.ts
```

## Performance Optimization

To maintain CPU budget (<8%):
- Use "low" FPS mode (8-10 FPS) for posture detection
- Leverage GPU acceleration when available
- Share WASM resources with face landmarker
- Lazy load only when posture detection is enabled
- Clean up resources immediately when detection stops

## Future Enhancements

- Implement posture analysis logic using landmarks
- Add angle calculations for spine alignment
- Implement shoulder position tracking
- Add posture score calculation
- Integrate with reminder system for poor posture alerts
- Add visualization overlay for debugging
