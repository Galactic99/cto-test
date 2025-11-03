import { PoseLandmarker, FilesetResolver, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface PoseLandmarkerOptions {
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
  preferGpu?: boolean;
}

export interface PoseLandmarkerInstance {
  detect: (video: HTMLVideoElement) => PoseLandmarkerResult | null;
  close: () => void;
}

let poseLandmarkerInstance: PoseLandmarker | null = null;
let isInitializing = false;
let initializationPromise: Promise<PoseLandmarker> | null = null;

function getWasmPath(): string {
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname === 'localhost'
  ) {
    return '/node_modules/@mediapipe/tasks-vision/wasm';
  }
  return './wasm';
}

async function initializePoseLandmarkerInternal(
  options: PoseLandmarkerOptions = {}
): Promise<PoseLandmarker> {
  const startTime = performance.now();
  console.log('[PoseLandmarker] Initializing Pose Landmarker...');
  console.log('[PoseLandmarker] Options:', options);

  try {
    const wasmPath = getWasmPath();
    console.log('[PoseLandmarker] Loading WASM from:', wasmPath);

    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    const loadTime = performance.now() - startTime;
    console.log(`[PoseLandmarker] WASM loaded in ${loadTime.toFixed(2)}ms`);

    const { preferGpu = true, ...poseLandmarkerOptions } = options;

    const createOptions = {
      runningMode: 'VIDEO' as const,
      minPoseDetectionConfidence: poseLandmarkerOptions.minPoseDetectionConfidence ?? 0.5,
      minPosePresenceConfidence: poseLandmarkerOptions.minPosePresenceConfidence ?? 0.5,
      minTrackingConfidence: poseLandmarkerOptions.minTrackingConfidence ?? 0.5,
      outputSegmentationMasks: false,
    };

    let poseLandmarker: PoseLandmarker;
    let delegate = 'CPU';

    if (preferGpu) {
      try {
        console.log('[PoseLandmarker] Attempting to use GPU delegate...');
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          ...createOptions,
        });
        delegate = 'GPU';
      } catch (error) {
        console.warn('[PoseLandmarker] GPU not available, falling back to CPU:', error);
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          ...createOptions,
        });
      }
    } else {
      console.log('[PoseLandmarker] Using CPU delegate as specified');
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        ...createOptions,
      });
    }

    const totalTime = performance.now() - startTime;
    console.log(
      `[PoseLandmarker] Pose Landmarker initialized successfully with ${delegate} delegate in ${totalTime.toFixed(2)}ms`
    );

    return poseLandmarker;
  } catch (error) {
    const errorTime = performance.now() - startTime;
    console.error(
      `[PoseLandmarker] Failed to initialize Pose Landmarker after ${errorTime.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}

export async function initializePoseLandmarker(
  options: PoseLandmarkerOptions = {}
): Promise<PoseLandmarkerInstance> {
  if (poseLandmarkerInstance) {
    console.log('[PoseLandmarker] Reusing existing Pose Landmarker instance');
    return createPoseLandmarkerInstance(poseLandmarkerInstance);
  }

  if (isInitializing && initializationPromise) {
    console.log('[PoseLandmarker] Waiting for ongoing initialization...');
    const instance = await initializationPromise;
    return createPoseLandmarkerInstance(instance);
  }

  isInitializing = true;
  initializationPromise = initializePoseLandmarkerInternal(options)
    .then((instance) => {
      poseLandmarkerInstance = instance;
      isInitializing = false;
      return instance;
    })
    .catch((error) => {
      isInitializing = false;
      initializationPromise = null;
      throw error;
    });

  const instance = await initializationPromise;
  return createPoseLandmarkerInstance(instance);
}

function createPoseLandmarkerInstance(landmarker: PoseLandmarker): PoseLandmarkerInstance {
  return {
    detect: (video: HTMLVideoElement): PoseLandmarkerResult | null => {
      try {
        if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
          return null;
        }

        const timestamp = performance.now();
        const result = landmarker.detectForVideo(video, timestamp);
        return result;
      } catch (error) {
        console.error('[PoseLandmarker] Detection error:', error);
        return null;
      }
    },
    close: () => {
      console.log('[PoseLandmarker] Closing Pose Landmarker (no-op, shared instance)');
    },
  };
}

export function closePoseLandmarker(): void {
  if (poseLandmarkerInstance) {
    console.log('[PoseLandmarker] Closing Pose Landmarker instance');
    try {
      poseLandmarkerInstance.close();
    } catch (error) {
      console.error('[PoseLandmarker] Error closing Pose Landmarker:', error);
    }
    poseLandmarkerInstance = null;
    initializationPromise = null;
    isInitializing = false;
    console.log('[PoseLandmarker] Pose Landmarker closed successfully');
  }
}

export function isPoseLandmarkerInitialized(): boolean {
  return poseLandmarkerInstance !== null;
}

export function isPoseLandmarkerInitializing(): boolean {
  return isInitializing;
}
