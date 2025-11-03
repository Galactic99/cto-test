import {
  initializePoseLandmarker,
  closePoseLandmarker,
  isPoseLandmarkerInitialized,
  isPoseLandmarkerInitializing,
} from '../src/renderer/sensor/models/poseLandmarker';

jest.mock('@mediapipe/tasks-vision', () => {
  const mockDetect = jest.fn(() => ({
    landmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
    worldLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
  }));

  const mockClose = jest.fn();

  const mockPoseLandmarker = {
    detectForVideo: mockDetect,
    close: mockClose,
  };

  return {
    PoseLandmarker: {
      createFromOptions: jest.fn().mockResolvedValue(mockPoseLandmarker),
    },
    FilesetResolver: {
      forVisionTasks: jest.fn().mockResolvedValue({}),
    },
  };
});

describe('PoseLandmarker', () => {
  beforeEach(() => {
    closePoseLandmarker();
    jest.clearAllMocks();
  });

  afterEach(() => {
    closePoseLandmarker();
  });

  describe('initializePoseLandmarker', () => {
    it('should initialize the pose landmarker successfully', async () => {
      const instance = await initializePoseLandmarker();
      expect(instance).toBeDefined();
      expect(instance.detect).toBeDefined();
      expect(instance.close).toBeDefined();
      expect(isPoseLandmarkerInitialized()).toBe(true);
    });

    it('should reuse existing instance on subsequent calls', async () => {
      const instance1 = await initializePoseLandmarker();
      const instance2 = await initializePoseLandmarker();

      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
    });

    it('should handle GPU preference option', async () => {
      const instance = await initializePoseLandmarker({ preferGpu: true });
      expect(instance).toBeDefined();
    });

    it('should handle CPU fallback option', async () => {
      const instance = await initializePoseLandmarker({ preferGpu: false });
      expect(instance).toBeDefined();
    });

    it('should fallback to CPU when GPU fails', async () => {
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const mockPoseLandmarker = {
        detectForVideo: jest.fn(),
        close: jest.fn(),
      };

      (PoseLandmarker.createFromOptions as jest.Mock)
        .mockRejectedValueOnce(new Error('GPU not available'))
        .mockResolvedValueOnce(mockPoseLandmarker);

      const instance = await initializePoseLandmarker({ preferGpu: true });
      expect(instance).toBeDefined();
      expect(isPoseLandmarkerInitialized()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      (PoseLandmarker.createFromOptions as jest.Mock)
        .mockRejectedValueOnce(new Error('GPU failed'))
        .mockRejectedValueOnce(new Error('Failed to load model'));

      await expect(initializePoseLandmarker()).rejects.toThrow('Failed to load model');
      expect(isPoseLandmarkerInitialized()).toBe(false);
    });

    it('should handle concurrent initialization requests', async () => {
      const promise1 = initializePoseLandmarker();
      const promise2 = initializePoseLandmarker();

      expect(isPoseLandmarkerInitializing()).toBe(true);

      const [instance1, instance2] = await Promise.all([promise1, promise2]);

      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
      expect(isPoseLandmarkerInitialized()).toBe(true);
    });
  });

  describe('closePoseLandmarker', () => {
    it('should clean up resources', async () => {
      await initializePoseLandmarker();
      expect(isPoseLandmarkerInitialized()).toBe(true);

      closePoseLandmarker();
      expect(isPoseLandmarkerInitialized()).toBe(false);
    });

    it('should handle multiple close calls gracefully', async () => {
      await initializePoseLandmarker();
      closePoseLandmarker();
      closePoseLandmarker();

      expect(isPoseLandmarkerInitialized()).toBe(false);
    });
  });

  describe('PoseLandmarkerInstance', () => {
    it('should detect pose from video', async () => {
      const instance = await initializePoseLandmarker();

      const mockVideo = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;

      const result = instance.detect(mockVideo);
      expect(result).toBeDefined();
    });

    it('should return null for invalid video', async () => {
      const instance = await initializePoseLandmarker();

      const mockVideo = {
        readyState: 0,
        videoWidth: 0,
        videoHeight: 0,
      } as HTMLVideoElement;

      const result = instance.detect(mockVideo);
      expect(result).toBeNull();
    });

    it('should handle detection errors', async () => {
      const instance = await initializePoseLandmarker();

      const mockVideo = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
      } as HTMLVideoElement;

      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const mockPoseLandmarker = await PoseLandmarker.createFromOptions({} as any, {} as any);
      (mockPoseLandmarker.detectForVideo as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Detection failed');
      });

      const result = instance.detect(mockVideo);
      expect(result).toBeNull();
    });
  });

  describe('isPoseLandmarkerInitialized', () => {
    it('should return false when not initialized', () => {
      expect(isPoseLandmarkerInitialized()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await initializePoseLandmarker();
      expect(isPoseLandmarkerInitialized()).toBe(true);
    });

    it('should return false after closing', async () => {
      await initializePoseLandmarker();
      closePoseLandmarker();
      expect(isPoseLandmarkerInitialized()).toBe(false);
    });
  });

  describe('isPoseLandmarkerInitializing', () => {
    it('should return false when not initializing', () => {
      expect(isPoseLandmarkerInitializing()).toBe(false);
    });

    it('should return true during initialization', async () => {
      const promise = initializePoseLandmarker();
      expect(isPoseLandmarkerInitializing()).toBe(true);
      await promise;
      expect(isPoseLandmarkerInitializing()).toBe(false);
    });

    it('should return false after initialization completes', async () => {
      await initializePoseLandmarker();
      expect(isPoseLandmarkerInitializing()).toBe(false);
    });

    it('should return false after initialization fails', async () => {
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      (PoseLandmarker.createFromOptions as jest.Mock).mockRejectedValueOnce(
        new Error('Initialization failed')
      );

      try {
        await initializePoseLandmarker();
      } catch {
        // Expected
      }

      expect(isPoseLandmarkerInitializing()).toBe(false);
    });
  });
});
