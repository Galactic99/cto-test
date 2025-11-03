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
import { DetectionLoop, createDetectionLoop } from './loop';
import { RetryManager } from './retryManager';
import { DetectionError, DetectionErrorType, DetectionMetrics } from '../../types/detection';

declare global {
  interface Window {
    sensorAPI: {
      onStartCamera: (callback: () => void) => void;
      onStopCamera: (callback: () => void) => void;
      notifyCameraError: (error: string) => void;
      notifyDetectionError: (error: DetectionError) => void;
      notifyCameraStarted: () => void;
      notifyCameraStopped: () => void;
      onDetectionConfigure: (
        callback: (config: {
          features: DetectionFeatures;
          fpsMode: FpsMode;
          postureBaselinePitch?: number;
        }) => void
      ) => void;
      sendMetricsUpdate: (metrics: DetectionMetrics) => void;
      onCalibratePosture: (callback: () => void) => void;
      sendCalibrationResult: (baseline: number) => void;
      onRetryDetection: (callback: () => void) => void;
    };
    getBlinkMetrics?: () => BlinkMetrics | null;
    getPostureMetrics?: () => PostureMetrics | null;
  }
}

interface DetectionConfig {
  features: DetectionFeatures;
  fpsMode: FpsMode;
  postureBaselinePitch?: number;
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
let detectionLoop: DetectionLoop | null = null;
let warmupFramesProcessed = 0;
const WARMUP_FRAMES = 5;
const METRICS_REPORT_INTERVAL = 5000;
let lastMetricsReportTime = 0;
let isCalibrating = false;
let calibrationSamples: number[] = [];
const CALIBRATION_DURATION = 5000;
let calibrationStartTime = 0;
let retryManager: RetryManager | null = null;
let detectionErrorCount = 0;
const MAX_CONSECUTIVE_ERRORS = 10;

function createDetectionError(
  type: DetectionErrorType,
  message: string,
  retryable: boolean = true
): DetectionError {
  return {
    type,
    message,
    timestamp: Date.now(),
    retryable,
    retryCount: retryManager?.getState().attempts || 0,
  };
}

function handleDetectionError(error: DetectionError): void {
  console.error('[Sensor] Detection error:', error);
  window.sensorAPI.notifyDetectionError(error);

  if (error.retryable && retryManager && retryManager.canRetry()) {
    console.log('[Sensor] Scheduling automatic retry with backoff');
    retryManager.scheduleRetry(async () => {
      console.log('[Sensor] Attempting automatic recovery...');
      await startCamera();
    });
  } else if (!retryManager?.canRetry()) {
    console.error('[Sensor] Max retries reached, stopping automatic recovery');
  }
}

function runDetectionLoop(): void {
  if (!videoElement || !detectionConfig) {
    return;
  }

  if (!faceLandmarker && !poseLandmarker) {
    return;
  }

  if (!detectionLoop) {
    detectionLoop = createDetectionLoop({
      fpsMode: detectionConfig.fpsMode,
      skipFrames: 1,
    });
    detectionLoop.resetMetrics();
    console.log('[Sensor] Detection loop controller initialized');
  }

  function detectFrame(): void {
    try {
      const now = performance.now();

      if (!detectionLoop || !videoElement || !detectionConfig) {
        return;
      }

      if (!detectionLoop.shouldProcessFrame(now)) {
        detectionLoopId = requestAnimationFrame(detectFrame);
        return;
      }

      const processingStartTime = performance.now();
      let hasResult = false;

      if (detectionConfig.features.blink && faceLandmarker) {
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

      if (detectionConfig.features.posture && poseLandmarker) {
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

            if (isCalibrating) {
              const metrics = postureDetector.getMetrics();
              calibrationSamples.push(metrics.headPitchAngle);

              if (now - calibrationStartTime >= CALIBRATION_DURATION) {
                const averageBaseline =
                  calibrationSamples.reduce((sum, val) => sum + val, 0) /
                  calibrationSamples.length;
                console.log(
                  `[Sensor] Calibration complete: baseline=${averageBaseline.toFixed(2)}° (${calibrationSamples.length} samples)`
                );
                window.sensorAPI.sendCalibrationResult(averageBaseline);
                isCalibrating = false;
                calibrationSamples = [];
              }
            }
          }
        }
      }

      if (hasResult) {
        detectionErrorCount = 0;
        const processingEndTime = performance.now();
        detectionLoop.recordProcessingTime(processingStartTime, processingEndTime);

        if (now - lastMetricsReportTime >= METRICS_REPORT_INTERVAL) {
          const metricsUpdate: DetectionMetrics = {};
          const loopMetrics = detectionLoop.getMetrics(now);

          console.log(
            `[Sensor] Performance: ${loopMetrics.currentFps.toFixed(2)} FPS (target: ${loopMetrics.targetFps}), CPU: ${loopMetrics.cpuUsagePercent.toFixed(2)}%, Processed: ${loopMetrics.framesProcessed}, Skipped: ${loopMetrics.framesSkipped}`
          );

          if (loopMetrics.isThrottled) {
            console.warn(`[Sensor] Throttling active: ${loopMetrics.throttleReason}`);
          }

          if (detectionConfig.features.blink && blinkDetector && blinkRateAggregator) {
            const metrics = blinkDetector.getMetrics(now);
            const aggregatedMetrics = blinkRateAggregator.getMetrics(now);
            console.log(
              `[Sensor] Blink Metrics: Count=${metrics.blinkCount}, Instant BPM=${metrics.blinksPerMinute}, Aggregated BPM=${aggregatedMetrics.blinksPerMinute.toFixed(2)}, EAR=${metrics.averageEAR.toFixed(3)}`
            );

            metricsUpdate.blink = {
              timestamp: now,
              blinkCount: aggregatedMetrics.eventCount,
              blinkRate: aggregatedMetrics.blinksPerMinute,
            };
          }

          if (detectionConfig.features.posture && postureDetector) {
            const postureMetrics = postureDetector.getMetrics();
            console.log(
              `[Sensor] Posture Metrics: Score=${postureMetrics.postureScore.toFixed(1)}, Head Pitch=${postureMetrics.headPitchAngle.toFixed(1)}°, Shoulder Roll=${postureMetrics.shoulderRollAngle.toFixed(2)}`
            );

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

          detectionLoop.resetMetrics();
          lastMetricsReportTime = now;
        }
      }

      detectionLoopId = requestAnimationFrame(detectFrame);
    } catch (error) {
      detectionErrorCount++;
      console.error('[Sensor] Runtime error in detection loop:', error);

      if (detectionErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        console.error('[Sensor] Too many consecutive errors, stopping detection');
        stopDetectionLoop();
        const detectionError = createDetectionError(
          'runtime_error',
          `Detection loop failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${
            error instanceof Error ? error.message : String(error)
          }`,
          true
        );
        handleDetectionError(detectionError);
      } else {
        detectionLoopId = requestAnimationFrame(detectFrame);
      }
    }
  }

  detectFrame();
}

function stopDetectionLoop(): void {
  if (detectionLoopId !== null) {
    cancelAnimationFrame(detectionLoopId);
    detectionLoopId = null;
    lastMetricsReportTime = 0;
    warmupFramesProcessed = 0;
    console.log('[Sensor] Detection loop stopped');
  }

  if (detectionLoop) {
    detectionLoop.reset();
    detectionLoop = null;
    console.log('[Sensor] Detection loop controller cleaned up');
  }
}

async function initializeModel(): Promise<void> {
  if (!detectionConfig) {
    console.log('[Sensor] No detection config available');
    return;
  }

  try {
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
          const detectionError = createDetectionError(
            'model_load_failed',
            `Failed to load face detection model: ${error instanceof Error ? error.message : String(error)}`,
            true
          );
          handleDetectionError(detectionError);
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
          const detectionError = createDetectionError(
            'model_load_failed',
            `Failed to load posture detection model: ${error instanceof Error ? error.message : String(error)}`,
            true
          );
          handleDetectionError(detectionError);
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

      if (detectionConfig.postureBaselinePitch !== undefined) {
        postureDetector.setBaseline(detectionConfig.postureBaselinePitch);
        console.log(
          `[Sensor] Applied baseline pitch: ${detectionConfig.postureBaselinePitch.toFixed(2)}°`
        );
      }
    }
  } catch (error) {
    throw error;
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
    
    if (!retryManager) {
      retryManager = new RetryManager();
      console.log('[Sensor] Retry manager initialized');
    }
    
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

    detectionErrorCount = 0;
    if (retryManager) {
      retryManager.reset();
    }

    window.sensorAPI.notifyCameraStarted();
  } catch (error) {
    console.error('[Sensor] Error starting camera:', error);
    let errorMessage = 'Unknown error';
    let errorType: DetectionErrorType = 'unknown';
    let retryable = true;

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'name' in error) {
      const domError = error as DOMException;
      errorMessage = domError.name;

      if (domError.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied by user';
        errorType = 'camera_permission_denied';
        retryable = false;
      } else if (domError.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device';
        errorType = 'camera_not_found';
        retryable = false;
      } else if (domError.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application';
        errorType = 'camera_in_use';
        retryable = true;
      }
    }

    window.sensorAPI.notifyCameraError(errorMessage);

    const detectionError = createDetectionError(errorType, errorMessage, retryable);
    handleDetectionError(detectionError);
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

  if (detectionLoop) {
    detectionLoop.updateConfig({ fpsMode: config.fpsMode });
    console.log('[Sensor] Updated detection loop FPS mode:', config.fpsMode);
  }

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
    
    if (config.postureBaselinePitch !== undefined) {
      postureDetector.setBaseline(config.postureBaselinePitch);
      console.log(
        `[Sensor] Applied baseline pitch: ${config.postureBaselinePitch.toFixed(2)}°`
      );
    }
  }

  if (faceLandmarker && videoElement && mediaStream) {
    stopDetectionLoop();
    console.log('[Sensor] Restarting detection loop with new config');
    runDetectionLoop();
  }
});

window.sensorAPI.onCalibratePosture(() => {
  console.log('[Sensor] Posture calibration requested');
  if (!postureDetector || !detectionConfig?.features.posture) {
    console.error('[Sensor] Cannot calibrate: posture detector not available');
    return;
  }

  isCalibrating = true;
  calibrationSamples = [];
  calibrationStartTime = performance.now();
  console.log('[Sensor] Starting posture calibration (5 seconds)...');
});

window.sensorAPI.onRetryDetection(() => {
  console.log('[Sensor] Manual retry requested');
  if (retryManager) {
    retryManager.reset();
  }
  detectionErrorCount = 0;
  startCamera();
});

window.addEventListener('beforeunload', () => {
  console.log('[Sensor] Window unloading, stopping camera and cleaning up');
  if (retryManager) {
    retryManager.reset();
  }
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
