import {
  initializeFaceLandmarker,
  closeFaceLandmarker,
  isFaceLandmarkerInitialized,
  FaceLandmarkerInstance,
} from './models/faceLandmarker';
import { DetectionFeatures, FpsMode } from '../../types/settings';

declare global {
  interface Window {
    sensorAPI: {
      onStartCamera: (callback: () => void) => void;
      onStopCamera: (callback: () => void) => void;
      notifyCameraError: (error: string) => void;
      notifyCameraStarted: () => void;
      notifyCameraStopped: () => void;
      onDetectionConfigure: (
        callback: (config: { features: DetectionFeatures; fpsMode: FpsMode }) => void
      ) => void;
    };
  }
}

interface DetectionConfig {
  features: DetectionFeatures;
  fpsMode: FpsMode;
}

let mediaStream: MediaStream | null = null;
let videoElement: HTMLVideoElement | null = null;
let faceLandmarker: FaceLandmarkerInstance | null = null;
let detectionConfig: DetectionConfig | null = null;
let detectionLoopId: number | null = null;
let frameCount = 0;
let lastFpsLogTime = 0;
let warmupFramesProcessed = 0;
const WARMUP_FRAMES = 5;

function getFpsInterval(fpsMode: FpsMode): number {
  switch (fpsMode) {
    case 'low':
      return 1000 / 10;
    case 'medium':
      return 1000 / 15;
    case 'high':
      return 1000 / 30;
    default:
      return 1000 / 15;
  }
}

function runDetectionLoop(): void {
  if (!videoElement || !faceLandmarker || !detectionConfig) {
    return;
  }

  const fpsInterval = getFpsInterval(detectionConfig.fpsMode);
  let lastFrameTime = performance.now();

  function detectFrame(): void {
    const now = performance.now();
    const elapsed = now - lastFrameTime;

    if (elapsed >= fpsInterval) {
      lastFrameTime = now - (elapsed % fpsInterval);

      if (videoElement && faceLandmarker) {
        const result = faceLandmarker.detect(videoElement);

        if (result) {
          frameCount++;

          if (warmupFramesProcessed < WARMUP_FRAMES) {
            warmupFramesProcessed++;
            if (warmupFramesProcessed === WARMUP_FRAMES) {
              console.log('[Sensor] Warmup complete, model ready for detection');
            }
          }

          if (now - lastFpsLogTime >= 5000) {
            const fps = (frameCount / 5).toFixed(2);
            const targetFps = 1000 / fpsInterval;
            const cpuUsage = ((parseFloat(fps) / targetFps) * 5).toFixed(2);

            console.log(
              `[Sensor] Performance: ${fps} FPS (target: ${targetFps}), ~${cpuUsage}% estimated CPU usage`
            );

            frameCount = 0;
            lastFpsLogTime = now;
          }
        }
      }
    }

    detectionLoopId = requestAnimationFrame(detectFrame);
  }

  detectFrame();
}

function stopDetectionLoop(): void {
  if (detectionLoopId !== null) {
    cancelAnimationFrame(detectionLoopId);
    detectionLoopId = null;
    frameCount = 0;
    lastFpsLogTime = 0;
    warmupFramesProcessed = 0;
    console.log('[Sensor] Detection loop stopped');
  }
}

async function initializeModel(): Promise<void> {
  if (faceLandmarker) {
    console.log('[Sensor] Model already initialized');
    return;
  }

  if (!isFaceLandmarkerInitialized()) {
    console.log('[Sensor] Initializing Face Landmarker model...');
    const startTime = performance.now();

    try {
      faceLandmarker = await initializeFaceLandmarker({
        preferGpu: true,
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      const loadTime = performance.now() - startTime;
      console.log(`[Sensor] Model initialized successfully in ${loadTime.toFixed(2)}ms`);
      console.log('[Sensor] Model ready for detection');
    } catch (error) {
      console.error('[Sensor] Failed to initialize model:', error);
      throw error;
    }
  } else {
    faceLandmarker = await initializeFaceLandmarker();
    console.log('[Sensor] Reusing existing model instance');
  }
}

function cleanupModel(): void {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }

  closeFaceLandmarker();
  console.log('[Sensor] Model resources cleaned up');
}

async function startCamera(): Promise<void> {
  try {
    console.log('[Sensor] Starting camera...');
    videoElement = document.getElementById('video') as HTMLVideoElement;

    if (!videoElement) {
      throw new Error('Video element not found');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    videoElement.srcObject = mediaStream;
    console.log('[Sensor] Camera started successfully');

    await initializeModel();

    if (detectionConfig) {
      console.log('[Sensor] Starting detection loop with config:', detectionConfig);
      runDetectionLoop();
    }

    window.sensorAPI.notifyCameraStarted();
  } catch (error) {
    console.error('[Sensor] Error starting camera:', error);
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'name' in error) {
      const domError = error as DOMException;
      errorMessage = domError.name;

      if (domError.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied by user';
      } else if (domError.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device';
      } else if (domError.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application';
      }
    }

    window.sensorAPI.notifyCameraError(errorMessage);
  }
}

function stopCamera(): void {
  console.log('[Sensor] Stopping camera...');

  stopDetectionLoop();

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => {
      track.stop();
      console.log('[Sensor] Stopped track:', track.kind);
    });
    mediaStream = null;
  }

  if (videoElement) {
    videoElement.srcObject = null;
  }

  cleanupModel();

  console.log('[Sensor] Camera stopped successfully');
  window.sensorAPI.notifyCameraStopped();
}

window.sensorAPI.onStartCamera(() => {
  console.log('[Sensor] Received start camera command');
  startCamera();
});

window.sensorAPI.onStopCamera(() => {
  console.log('[Sensor] Received stop camera command');
  stopCamera();
});

window.sensorAPI.onDetectionConfigure((config) => {
  console.log('[Sensor] Received detection configuration:', config);
  detectionConfig = config;

  if (faceLandmarker && videoElement && mediaStream) {
    stopDetectionLoop();
    console.log('[Sensor] Restarting detection loop with new config');
    runDetectionLoop();
  }
});

window.addEventListener('beforeunload', () => {
  console.log('[Sensor] Window unloading, stopping camera and cleaning up');
  stopDetectionLoop();
  stopCamera();
});

console.log('[Sensor] Sensor window initialized');
