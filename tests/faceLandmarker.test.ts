import {
  initializeFaceLandmarker,
  closeFaceLandmarker,
  isFaceLandmarkerInitialized,
  isFaceLandmarkerInitializing,
} from '../src/renderer/sensor/models/faceLandmarker';

jest.mock('@mediapipe/tasks-vision', () => {
  const mockDetect = jest.fn(() => ({
    faceLandmarks: [],
    faceBlendshapes: [],
  }));

  const mockClose = jest.fn();

  const mockFaceLandmarker = {
    detectForVideo: mockDetect,
    close: mockClose,
  };

  return {
    FaceLandmarker: {
      createFromOptions: jest.fn().mockResolvedValue(mockFaceLandmarker),
    },
    FilesetResolver: {
      forVisionTasks: jest.fn().mockResolvedValue({}),
    },
  };
});

describe('FaceLandmarker', () => {
  beforeEach(() => {
    closeFaceLandmarker();
    jest.clearAllMocks();
  });

  afterEach(() => {
    closeFaceLandmarker();
  });

  describe('initializeFaceLandmarker', () => {
    it('should initialize the face landmarker successfully', async () => {
      const instance = await initializeFaceLandmarker();
      expect(instance).toBeDefined();
      expect(instance.detect).toBeDefined();
      expect(instance.close).toBeDefined();
      expect(isFaceLandmarkerInitialized()).toBe(true);
    });

    it('should reuse existing instance on subsequent calls', async () => {
      const instance1 = await initializeFaceLandmarker();
      const instance2 = await initializeFaceLandmarker();

      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
    });

    it('should handle GPU preference option', async () => {
      const instance = await initializeFaceLandmarker({ preferGpu: true });
      expect(instance).toBeDefined();
    });

    it('should handle CPU fallback option', async () => {
      const instance = await initializeFaceLandmarker({ preferGpu: false });
      expect(instance).toBeDefined();
    });

    it('should fallback to CPU when GPU fails', async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const mockFaceLandmarker = {
        detectForVideo: jest.fn(),
        close: jest.fn(),
      };

      (FaceLandmarker.createFromOptions as jest.Mock)
        .mockRejectedValueOnce(new Error('GPU not available'))
        .mockResolvedValueOnce(mockFaceLandmarker);

      const instance = await initializeFaceLandmarker({ preferGpu: true });
      expect(instance).toBeDefined();
      expect(isFaceLandmarkerInitialized()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      (FaceLandmarker.createFromOptions as jest.Mock)
        .mockRejectedValueOnce(new Error('GPU failed'))
        .mockRejectedValueOnce(new Error('Failed to load model'));

      await expect(initializeFaceLandmarker()).rejects.toThrow('Failed to load model');
      expect(isFaceLandmarkerInitialized()).toBe(false);
    });

    it('should handle concurrent initialization requests', async () => {
      const promise1 = initializeFaceLandmarker();
      const promise2 = initializeFaceLandmarker();

      expect(isFaceLandmarkerInitializing()).toBe(true);

      const [instance1, instance2] = await Promise.all([promise1, promise2]);

      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
      expect(isFaceLandmarkerInitialized()).toBe(true);
    });
  });

  describe('closeFaceLandmarker', () => {
    it('should clean up resources', async () => {
      await initializeFaceLandmarker();
      expect(isFaceLandmarkerInitialized()).toBe(true);

      closeFaceLandmarker();
      expect(isFaceLandmarkerInitialized()).toBe(false);
    });

    it('should handle multiple close calls gracefully', async () => {
      await initializeFaceLandmarker();
      closeFaceLandmarker();
      closeFaceLandmarker();

      expect(isFaceLandmarkerInitialized()).toBe(false);
    });
  });

  describe('FaceLandmarkerInstance', () => {
    it('should detect faces from video', async () => {
      const instance = await initializeFaceLandmarker();

      const mockVideo = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;

      const result = instance.detect(mockVideo);
      expect(result).toBeDefined();
    });

    it('should return null for invalid video', async () => {
      const instance = await initializeFaceLandmarker();

      const mockVideo = {
        readyState: 0,
        videoWidth: 0,
        videoHeight: 0,
      } as HTMLVideoElement;

      const result = instance.detect(mockVideo);
      expect(result).toBeNull();
    });

    it('should handle detection errors', async () => {
      const instance = await initializeFaceLandmarker();

      const mockVideo = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;

      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const mockFaceLandmarker = await FaceLandmarker.createFromOptions({} as any, {} as any);
      (mockFaceLandmarker.detectForVideo as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Detection failed');
      });

      const result = instance.detect(mockVideo);
      expect(result).toBeNull();
    });
  });

  describe('isFaceLandmarkerInitialized', () => {
    it('should return false when not initialized', () => {
      expect(isFaceLandmarkerInitialized()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await initializeFaceLandmarker();
      expect(isFaceLandmarkerInitialized()).toBe(true);
    });

    it('should return false after closing', async () => {
      await initializeFaceLandmarker();
      closeFaceLandmarker();
      expect(isFaceLandmarkerInitialized()).toBe(false);
    });
  });

  describe('isFaceLandmarkerInitializing', () => {
    it('should return false when not initializing', () => {
      expect(isFaceLandmarkerInitializing()).toBe(false);
    });

    it('should return true during initialization', async () => {
      const promise = initializeFaceLandmarker();
      expect(isFaceLandmarkerInitializing()).toBe(true);
      await promise;
      expect(isFaceLandmarkerInitializing()).toBe(false);
    });

    it('should return false after initialization completes', async () => {
      await initializeFaceLandmarker();
      expect(isFaceLandmarkerInitializing()).toBe(false);
    });

    it('should return false after initialization fails', async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      (FaceLandmarker.createFromOptions as jest.Mock).mockRejectedValueOnce(
        new Error('Initialization failed')
      );

      try {
        await initializeFaceLandmarker();
      } catch {
        // Expected
      }

      expect(isFaceLandmarkerInitializing()).toBe(false);
    });
  });
});
