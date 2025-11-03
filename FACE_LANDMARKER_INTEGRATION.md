# Face Landmarker Integration

This document describes the MediaPipe Face Landmarker integration for blink detection.

## Overview

The Face Landmarker model is integrated into the sensor window to provide real-time face landmark detection for blink detection processing.

## Architecture

### Components

1. **faceLandmarker.ts** (`src/renderer/sensor/models/faceLandmarker.ts`)
   - Lazy-loads the MediaPipe Face Landmarker model
   - Manages model lifecycle (initialization, inference, cleanup)
   - Implements GPU preference with CPU fallback
   - Provides singleton pattern for efficient resource usage

2. **sensor.ts** (`src/renderer/sensor/sensor.ts`)
   - Integrates Face Landmarker into camera lifecycle
   - Runs detection loop at configurable FPS
   - Handles warmup frames for model stabilization
   - Logs performance metrics for monitoring

### Model Loading

The Face Landmarker uses lazy loading to avoid blocking the UI:
- Model is loaded when camera starts
- WASM files are bundled with the application for offline use
- GPU delegate is preferred, with automatic CPU fallback
- Initialization time is logged for performance monitoring

### Asset Bundling

WASM assets are automatically copied during build:
- Source: `node_modules/@mediapipe/tasks-vision/wasm`
- Destination: `dist-electron/renderer/wasm`
- Files: `vision_wasm_internal.{js,wasm}` and `vision_wasm_nosimd_internal.{js,wasm}`

### Detection Loop

The detection loop runs at configurable FPS:
- **Low**: 10 FPS (~10% CPU)
- **Medium**: 15 FPS (~7% CPU) - default
- **High**: 30 FPS (~5% CPU)

Performance metrics are logged every 5 seconds:
- Actual FPS achieved
- Target FPS
- Estimated CPU usage

### Warmup Frames

The model processes 5 warmup frames before considering itself ready:
- Allows model to stabilize
- Improves inference accuracy
- Logged when complete: "Warmup complete, model ready for detection"

## API

### initializeFaceLandmarker(options?)

Initializes and returns a Face Landmarker instance.

**Options:**
- `numFaces`: Number of faces to detect (default: 1)
- `minFaceDetectionConfidence`: Minimum confidence for face detection (default: 0.5)
- `minFacePresenceConfidence`: Minimum confidence for face presence (default: 0.5)
- `minTrackingConfidence`: Minimum confidence for face tracking (default: 0.5)
- `preferGpu`: Whether to prefer GPU delegate (default: true)

**Returns:**
```typescript
{
  detect: (video: HTMLVideoElement) => FaceLandmarkerResult | null;
  close: () => void;
}
```

### closeFaceLandmarker()

Closes the Face Landmarker instance and releases resources.

### isFaceLandmarkerInitialized()

Returns whether the Face Landmarker is currently initialized.

### isFaceLandmarkerInitializing()

Returns whether the Face Landmarker is currently initializing.

## Usage Example

```typescript
import { initializeFaceLandmarker, closeFaceLandmarker } from './models/faceLandmarker';

// Initialize
const landmarker = await initializeFaceLandmarker({
  preferGpu: true,
  numFaces: 1,
});

// Detect faces
const video = document.getElementById('video') as HTMLVideoElement;
const result = landmarker.detect(video);

if (result && result.faceLandmarks.length > 0) {
  console.log('Detected face landmarks:', result.faceLandmarks[0]);
}

// Cleanup
closeFaceLandmarker();
```

## Resource Cleanup

Resources are automatically cleaned up in the following scenarios:
- Detection stop: `stopCamera()` calls `cleanupModel()`
- Window unload: `beforeunload` event handler calls cleanup
- Manual cleanup: Call `closeFaceLandmarker()` directly

## Performance Monitoring

Performance is monitored via console logs:
- Model initialization time
- Detection FPS (every 5 seconds)
- Estimated CPU usage
- Warmup completion

Example logs:
```
[FaceLandmarker] Initializing Face Landmarker...
[FaceLandmarker] Face Landmarker initialized successfully with GPU delegate in 127.45ms
[Sensor] Model ready for detection
[Sensor] Warmup complete, model ready for detection
[Sensor] Performance: 14.80 FPS (target: 15), ~4.93% estimated CPU usage
```

## Testing

Unit tests are provided in `tests/faceLandmarker.test.ts`:
- Model initialization (GPU/CPU)
- Resource cleanup
- Error handling
- Concurrent initialization
- Detection with valid/invalid video

Run tests:
```bash
npm test -- faceLandmarker.test.ts
```

## Future Enhancements

- Move detection to Web Worker for better UI performance
- Add blink detection logic using face landmarks
- Implement face mesh visualization for debugging
- Add configurable model path for custom models
