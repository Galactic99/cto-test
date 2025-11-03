import {
  initializeFaceLandmarker,
  closeFaceLandmarker,
  isFaceLandmarkerInitialized,
  FaceLandmarkerInstance,
} from './models/faceLandmarker';
import {
  initializePoseLandmarker,
  closePoseLandmarker,
  isPoseLandmarkerInitialized,
  PoseLandmarkerInstance,
} from './models/poseLandmarker';
import { DetectionFeatures, FpsMode } from '../../types/settings';
import { BlinkDetector, createBlinkDetector, BlinkMetrics } from './metrics/blink';
import { BlinkRateAggregator, createBlinkRateAggregator } from './metrics/aggregators';
import { PostureDetector, createPostureDetector, PostureMetrics } from './metrics/posture';

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
      sendMetricsUpdate: (metrics: any) => void;
    };
    getBlinkMetrics?: () => BlinkMetrics | null;
    getPostureMetrics?: () => PostureMetrics | null;
  }
}

interface DetectionConfig {
  features: DetectionFeatures;
  fpsMode: FpsMode;
}

let mediaStream: MediaStream | null = null;
let videoElement: HTMLVideoElement | null = null;
let faceLandmarker: FaceLandmarkerInstance | null = null;
let poseLandmarker: PoseLandmarkerInstance | null = null;
let blinkDetector: BlinkDetector | null = null;
let blinkRateAggregator: BlinkRateAggregator | null = null;
let postureDetector: PostureDetector | null = null;
let detectionConfig: DetectionConfig | null = null;
let detectionLoopId: number | null = null;
let frameCount = 0;
let lastFpsLogTime = 0;
let lastMetricsReportTime = 0;
let warmupFramesProcessed = 0;
const WARMUP_FRAMES = 5;
const METRICS_REPORT_INTERVAL = 5000;

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
  if (!videoElement || !detectionConfig) {
    return;
  }

  if (!faceLandmarker && !poseLandmarker) {
    return;
  }

  const fpsInterval = getFpsInterval(detectionConfig.fpsMode);
  let lastFrameTime = performance.now();

  function detectFrame(): void {
    const now = performance.now();
    const elapsed = now - lastFrameTime;

    if (elapsed >= fpsInterval) {
      lastFrameTime = now - (elapsed % fpsInterval);

      if (videoElement) {
        let hasResult = false;

        if (detectionConfig?.features.blink && faceLandmarker) {
          const result = faceLandmarker.detect(videoElement);

          if (result) {
            hasResult = true;

            if (warmupFramesProcessed < WARMUP_FRAMES) {
              warmupFramesProcessed++;
              if (warmupFramesProcessed === WARMUP_FRAMES) {
                console.log('[Sensor] Warmup complete, face model ready for detection');
              }
            }

            if (blinkDetector && warmupFramesProcessed >= WARMUP_FRAMES) {
              const previousBlinkCount = blinkDetector.getMetrics(now).blinkCount;
              blinkDetector.processFrame(result, now);
              const currentBlinkCount = blinkDetector.getMetrics(now).blinkCount;

              if (currentBlinkCount > previousBlinkCount && blinkRateAggregator) {
                blinkRateAggregator.addEvent(now);
              }
            }
          }
        }

        if (detectionConfig?.features.posture && poseLandmarker) {
          const result = poseLandmarker.detect(videoElement);

          if (result) {
            hasResult = true;

            if (warmupFramesProcessed < WARMUP_FRAMES) {
              warmupFramesProcessed++;
              if (warmupFramesProcessed === WARMUP_FRAMES) {
                console.log('[Sensor] Warmup complete, pose model ready for detection');
              }
            }

            if (postureDetector && warmupFramesProcessed >= WARMUP_FRAMES) {
              postureDetector.processFrame(result, now);
            }
          }
        }

        if (hasResult) {
          frameCount++;

          if (now - lastFpsLogTime >= 5000) {
            const fps = (frameCount / 5).toFixed(2);
            const targetFps = 1000 / fpsInterval;
            const cpuUsage = ((parseFloat(fps) / targetFps) * 5).toFixed(2);

            console.log(
              `[Sensor] Performance: ${fps} FPS (target: ${targetFps}), ~${cpuUsage}% estimated CPU usage`
            );

            if (detectionConfig?.features.blink && blinkDetector && blinkRateAggregator) {
              const metrics = blinkDetector.getMetrics(now);
              const aggregatedMetrics = blinkRateAggregator.getMetrics(now);
              console.log(
                `[Sensor] Blink Metrics: Count=${metrics.blinkCount}, Instant BPM=${metrics.blinksPerMinute}, Aggregated BPM=${aggregatedMetrics.blinksPerMinute.toFixed(2)}, EAR=${metrics.averageEAR.toFixed(3)}`
              );
            }

            if (detectionConfig?.features.posture && postureDetector) {
              const metrics = postureDetector.getMetrics();
              console.log(
                `[Sensor] Posture Metrics: Score=${metrics.postureScore.toFixed(1)}, Head Pitch=${metrics.headPitchAngle.toFixed(1)}°, Shoulder Roll=${metrics.shoulderRollAngle.toFixed(2)}`
              );
            }

            frameCount = 0;
            lastFpsLogTime = now;
          }

          if (now - lastMetricsReportTime >= METRICS_REPORT_INTERVAL) {
            const metricsUpdate: any = {};

            if (detectionConfig?.features.blink && blinkRateAggregator) {
              const aggregatedMetrics = blinkRateAggregator.getMetrics(now);
              metricsUpdate.blink = {
                timestamp: now,
                blinkCount: aggregatedMetrics.eventCount,
                blinkRate: aggregatedMetrics.blinksPerMinute,
              };
            }

            if (detectionConfig?.features.posture && postureDetector) {
              const postureMetrics = postureDetector.getMetrics();
              metricsUpdate.posture = {
                timestamp: now,
                postureScore: postureMetrics.postureScore,
                headPitchAngle: postureMetrics.headPitchAngle,
                shoulderRollAngle: postureMetrics.shoulderRollAngle,
              };
            }

            if (Object.keys(metricsUpdate).length > 0) {
              window.sensorAPI.sendMetricsUpdate(metricsUpdate);
            }

            lastMetricsReportTime = now;
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
    lastMetricsReportTime = 0;
    warmupFramesProcessed = 0;
    console.log('[Sensor] Detection loop stopped');
  }
}

async function initializeModel(): Promise<void> {
  if (!detectionConfig) {
    console.log('[Sensor] No detection config available');
    return;
  }

  if (detectionConfig.features.blink && !faceLandmarker) {
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
        console.log(
          `[Sensor] Face Landmarker initialized successfully in ${loadTime.toFixed(2)}ms`
        );
        console.log('[Sensor] Face Landmarker ready for detection');
      } catch (error) {
        console.error('[Sensor] Failed to initialize Face Landmarker:', error);
        throw error;
      }
    } else {
      faceLandmarker = await initializeFaceLandmarker();
      console.log('[Sensor] Reusing existing Face Landmarker instance');
    }

    if (!blinkDetector) {
      blinkDetector = createBlinkDetector();
      console.log('[Sensor] Blink detector initialized');
    }

    if (!blinkRateAggregator) {
      blinkRateAggregator = createBlinkRateAggregator(3);
      console.log('[Sensor] Blink rate aggregator initialized (3-minute window)');
    }
  }

  if (detectionConfig.features.posture && !poseLandmarker) {
    if (!isPoseLandmarkerInitialized()) {
      console.log('[Sensor] Initializing Pose Landmarker model...');
      const startTime = performance.now();

      try {
        poseLandmarker = await initializePoseLandmarker({
          preferGpu: true,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        const loadTime = performance.now() - startTime;
        console.log(
          `[Sensor] Pose Landmarker initialized successfully in ${loadTime.toFixed(2)}ms`
        );
        console.log('[Sensor] Pose Landmarker ready for detection');
      } catch (error) {
        console.error('[Sensor] Failed to initialize Pose Landmarker:', error);
        throw error;
      }
    } else {
      poseLandmarker = await initializePoseLandmarker();
      console.log('[Sensor] Reusing existing Pose Landmarker instance');
    }

    if (!postureDetector) {
      postureDetector = createPostureDetector();
      console.log('[Sensor] Posture detector initialized');
    }
  }
}

function cleanupModel(): void {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }

  if (poseLandmarker) {
    poseLandmarker.close();
    poseLandmarker = null;
  }

  if (blinkDetector) {
    blinkDetector.reset();
    blinkDetector = null;
    console.log('[Sensor] Blink detector cleaned up');
  }

  if (blinkRateAggregator) {
    blinkRateAggregator.reset();
    blinkRateAggregator = null;
    console.log('[Sensor] Blink rate aggregator cleaned up');
  }

  if (postureDetector) {
    postureDetector.reset();
    postureDetector = null;
    console.log('[Sensor] Posture detector cleaned up');
  }

  closeFaceLandmarker();
  closePoseLandmarker();
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

  if (blinkDetector && config.features.blink) {
    console.log('[Sensor] Resetting blink detector for new configuration');
    blinkDetector.reset();
  }

  if (blinkRateAggregator && config.features.blink) {
    console.log('[Sensor] Resetting blink rate aggregator for new configuration');
    blinkRateAggregator.reset();
  }

  if (postureDetector && config.features.posture) {
    console.log('[Sensor] Resetting posture detector for new configuration');
    postureDetector.reset();
  }

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

window.getBlinkMetrics = () => {
  if (!blinkDetector) {
    return null;
  }
  return blinkDetector.getMetrics();
};

window.getPostureMetrics = () => {
  if (!postureDetector) {
    return null;
  }
  return postureDetector.getMetrics();
};

console.log('[Sensor] Sensor window initialized');
