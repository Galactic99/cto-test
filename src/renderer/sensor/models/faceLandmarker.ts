import {
  FaceLandmarker,
  FilesetResolver,
  FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

export interface FaceLandmarkerOptions {
  numFaces?: number;
  minFaceDetectionConfidence?: number;
  minFacePresenceConfidence?: number;
  minTrackingConfidence?: number;
  preferGpu?: boolean;
}

export interface FaceLandmarkerInstance {
  detect: (video: HTMLVideoElement) => FaceLandmarkerResult | null;
  close: () => void;
}

let faceLandmarkerInstance: FaceLandmarker | null = null;
let isInitializing = false;
let initializationPromise: Promise<FaceLandmarker> | null = null;

function getWasmPath(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    return '/node_modules/@mediapipe/tasks-vision/wasm';
  }
  return './wasm';
}

async function initializeFaceLandmarkerInternal(
  options: FaceLandmarkerOptions = {}
): Promise<FaceLandmarker> {
  const startTime = performance.now();
  console.log('[FaceLandmarker] Initializing Face Landmarker...');
  console.log('[FaceLandmarker] Options:', options);

  try {
    const wasmPath = getWasmPath();
    console.log('[FaceLandmarker] Loading WASM from:', wasmPath);

    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    const loadTime = performance.now() - startTime;
    console.log(`[FaceLandmarker] WASM loaded in ${loadTime.toFixed(2)}ms`);

    const { preferGpu = true, ...faceLandmarkerOptions } = options;

    const createOptions = {
      runningMode: 'VIDEO' as const,
      numFaces: faceLandmarkerOptions.numFaces ?? 1,
      minFaceDetectionConfidence:
        faceLandmarkerOptions.minFaceDetectionConfidence ?? 0.5,
      minFacePresenceConfidence:
        faceLandmarkerOptions.minFacePresenceConfidence ?? 0.5,
      minTrackingConfidence: faceLandmarkerOptions.minTrackingConfidence ?? 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    };

    let faceLandmarker: FaceLandmarker;
    let delegate = 'CPU';

    if (preferGpu) {
      try {
        console.log('[FaceLandmarker] Attempting to use GPU delegate...');
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          ...createOptions,
        });
        delegate = 'GPU';
      } catch (error) {
        console.warn('[FaceLandmarker] GPU not available, falling back to CPU:', error);
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          ...createOptions,
        });
      }
    } else {
      console.log('[FaceLandmarker] Using CPU delegate as specified');
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        ...createOptions,
      });
    }

    const totalTime = performance.now() - startTime;
    console.log(
      `[FaceLandmarker] Face Landmarker initialized successfully with ${delegate} delegate in ${totalTime.toFixed(2)}ms`
    );

    return faceLandmarker;
  } catch (error) {
    const errorTime = performance.now() - startTime;
    console.error(
      `[FaceLandmarker] Failed to initialize Face Landmarker after ${errorTime.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}

export async function initializeFaceLandmarker(
  options: FaceLandmarkerOptions = {}
): Promise<FaceLandmarkerInstance> {
  if (faceLandmarkerInstance) {
    console.log('[FaceLandmarker] Reusing existing Face Landmarker instance');
    return createFaceLandmarkerInstance(faceLandmarkerInstance);
  }

  if (isInitializing && initializationPromise) {
    console.log('[FaceLandmarker] Waiting for ongoing initialization...');
    const instance = await initializationPromise;
    return createFaceLandmarkerInstance(instance);
  }

  isInitializing = true;
  initializationPromise = initializeFaceLandmarkerInternal(options)
    .then((instance) => {
      faceLandmarkerInstance = instance;
      isInitializing = false;
      return instance;
    })
    .catch((error) => {
      isInitializing = false;
      initializationPromise = null;
      throw error;
    });

  const instance = await initializationPromise;
  return createFaceLandmarkerInstance(instance);
}

function createFaceLandmarkerInstance(
  landmarker: FaceLandmarker
): FaceLandmarkerInstance {
  return {
    detect: (video: HTMLVideoElement): FaceLandmarkerResult | null => {
      try {
        if (
          !video ||
          video.readyState < 2 ||
          video.videoWidth === 0 ||
          video.videoHeight === 0
        ) {
          return null;
        }

        const timestamp = performance.now();
        const result = landmarker.detectForVideo(video, timestamp);
        return result;
      } catch (error) {
        console.error('[FaceLandmarker] Detection error:', error);
        return null;
      }
    },
    close: () => {
      console.log('[FaceLandmarker] Closing Face Landmarker (no-op, shared instance)');
    },
  };
}

export function closeFaceLandmarker(): void {
  if (faceLandmarkerInstance) {
    console.log('[FaceLandmarker] Closing Face Landmarker instance');
    try {
      faceLandmarkerInstance.close();
    } catch (error) {
      console.error('[FaceLandmarker] Error closing Face Landmarker:', error);
    }
    faceLandmarkerInstance = null;
    initializationPromise = null;
    isInitializing = false;
    console.log('[FaceLandmarker] Face Landmarker closed successfully');
  }
}

export function isFaceLandmarkerInitialized(): boolean {
  return faceLandmarkerInstance !== null;
}

export function isFaceLandmarkerInitializing(): boolean {
  return isInitializing;
}
