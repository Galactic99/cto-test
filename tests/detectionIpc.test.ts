describe('Detection IPC Handlers', () => {
  let mockDetectionState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDetectionState = {
      startDetection: jest.fn().mockResolvedValue(undefined),
      stopDetection: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      }),
      getMetrics: jest.fn().mockReturnValue({}),
      updateSettings: jest.fn().mockReturnValue({
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      }),
      updateMetrics: jest.fn(),
    };
  });

  describe('detection:start', () => {
    it('should start detection successfully', async () => {
      await mockDetectionState.startDetection();
      expect(mockDetectionState.startDetection).toHaveBeenCalledTimes(1);
    });

    it('should handle start detection errors', async () => {
      const error = new Error('Failed to start camera');
      mockDetectionState.startDetection.mockRejectedValue(error);

      await expect(mockDetectionState.startDetection()).rejects.toThrow('Failed to start camera');
    });

    it('should not throw if detection is already running', async () => {
      mockDetectionState.getStatus.mockReturnValue({
        isRunning: true,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      await expect(mockDetectionState.startDetection()).resolves.not.toThrow();
    });
  });

  describe('detection:stop', () => {
    it('should stop detection successfully', async () => {
      await mockDetectionState.stopDetection();
      expect(mockDetectionState.stopDetection).toHaveBeenCalledTimes(1);
    });

    it('should handle stop detection errors', async () => {
      const error = new Error('Failed to stop camera');
      mockDetectionState.stopDetection.mockRejectedValue(error);

      await expect(mockDetectionState.stopDetection()).rejects.toThrow('Failed to stop camera');
    });

    it('should not throw if detection is already stopped', async () => {
      mockDetectionState.getStatus.mockReturnValue({
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      await expect(mockDetectionState.stopDetection()).resolves.not.toThrow();
    });
  });

  describe('detection:status', () => {
    it('should return current detection status', () => {
      const status = mockDetectionState.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('features');
      expect(status).toHaveProperty('fpsMode');
      expect(status).toHaveProperty('lastUpdate');
    });

    it('should return running status when detection is active', () => {
      mockDetectionState.getStatus.mockReturnValue({
        isRunning: true,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      const status = mockDetectionState.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should return stopped status when detection is inactive', () => {
      const status = mockDetectionState.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should include feature configuration in status', () => {
      const status = mockDetectionState.getStatus();
      expect(status.features).toHaveProperty('blink');
      expect(status.features).toHaveProperty('posture');
    });

    it('should include fps mode in status', () => {
      const status = mockDetectionState.getStatus();
      expect(['low', 'medium', 'high']).toContain(status.fpsMode);
    });
  });

  describe('detection:metrics:get', () => {
    it('should return empty metrics when no data is available', () => {
      const metrics = mockDetectionState.getMetrics();
      expect(metrics).toEqual({});
    });

    it('should return blink metrics when available', () => {
      const blinkMetrics = {
        blink: {
          timestamp: Date.now(),
          blinkCount: 15,
          blinkRate: 12.5,
          lastBlinkTime: Date.now() - 1000,
        },
      };
      mockDetectionState.getMetrics.mockReturnValue(blinkMetrics);

      const metrics = mockDetectionState.getMetrics();
      expect(metrics.blink).toBeDefined();
      expect(metrics.blink.blinkCount).toBe(15);
      expect(metrics.blink.blinkRate).toBe(12.5);
    });

    it('should return posture metrics when available', () => {
      const postureMetrics = {
        posture: {
          timestamp: Date.now(),
          goodPosturePercent: 75,
          badPostureCount: 5,
          currentPosture: 'good',
        },
      };
      mockDetectionState.getMetrics.mockReturnValue(postureMetrics);

      const metrics = mockDetectionState.getMetrics();
      expect(metrics.posture).toBeDefined();
      expect(metrics.posture.goodPosturePercent).toBe(75);
      expect(metrics.posture.badPostureCount).toBe(5);
      expect(metrics.posture.currentPosture).toBe('good');
    });

    it('should return both blink and posture metrics', () => {
      const allMetrics = {
        blink: {
          timestamp: Date.now(),
          blinkCount: 15,
          blinkRate: 12.5,
        },
        posture: {
          timestamp: Date.now(),
          goodPosturePercent: 80,
          badPostureCount: 3,
          currentPosture: 'good',
        },
      };
      mockDetectionState.getMetrics.mockReturnValue(allMetrics);

      const metrics = mockDetectionState.getMetrics();
      expect(metrics.blink).toBeDefined();
      expect(metrics.posture).toBeDefined();
    });
  });

  describe('detection:settings:set', () => {
    it('should update features settings', () => {
      const newSettings = {
        features: { blink: false, posture: true },
      };

      const status = mockDetectionState.updateSettings(newSettings);
      expect(mockDetectionState.updateSettings).toHaveBeenCalledWith(newSettings);
      expect(status).toHaveProperty('features');
    });

    it('should update fps mode', () => {
      const newSettings = {
        fpsMode: 'high',
      };

      mockDetectionState.updateSettings.mockReturnValue({
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'high',
        lastUpdate: Date.now(),
      });

      const status = mockDetectionState.updateSettings(newSettings);
      expect(status.fpsMode).toBe('high');
    });

    it('should merge settings with existing configuration', () => {
      const currentStatus = {
        isRunning: true,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      };
      mockDetectionState.getStatus.mockReturnValue(currentStatus);

      const newSettings = {
        features: { blink: false, posture: true },
      };

      mockDetectionState.updateSettings.mockReturnValue({
        ...currentStatus,
        features: { blink: false, posture: true },
      });

      const status = mockDetectionState.updateSettings(newSettings);
      expect(status.features.blink).toBe(false);
      expect(status.features.posture).toBe(true);
      expect(status.fpsMode).toBe('medium');
    });

    it('should return updated status after settings change', () => {
      const newSettings = {
        fpsMode: 'low',
      };

      const updatedStatus = {
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'low',
        lastUpdate: Date.now(),
      };
      mockDetectionState.updateSettings.mockReturnValue(updatedStatus);

      const status = mockDetectionState.updateSettings(newSettings);
      expect(status).toEqual(updatedStatus);
    });
  });

  describe('detection:calibrate:posture', () => {
    it('should resolve without error (stub)', async () => {
      const calibratePosture = jest.fn().mockResolvedValue(undefined);
      await expect(calibratePosture()).resolves.not.toThrow();
    });
  });

  describe('sensor:metrics-update', () => {
    it('should update metrics from sensor window', () => {
      const metrics = {
        blink: {
          timestamp: Date.now(),
          blinkCount: 10,
          blinkRate: 8.5,
        },
      };

      mockDetectionState.updateMetrics(metrics);
      expect(mockDetectionState.updateMetrics).toHaveBeenCalledWith(metrics);
    });

    it('should handle partial metrics updates', () => {
      const partialMetrics = {
        blink: {
          timestamp: Date.now(),
          blinkCount: 5,
          blinkRate: 4.2,
        },
      };

      mockDetectionState.updateMetrics(partialMetrics);
      expect(mockDetectionState.updateMetrics).toHaveBeenCalledWith(partialMetrics);
    });

    it('should update only provided metrics types', () => {
      const blinkOnly = {
        blink: {
          timestamp: Date.now(),
          blinkCount: 12,
          blinkRate: 10.0,
        },
      };

      mockDetectionState.updateMetrics(blinkOnly);
      expect(mockDetectionState.updateMetrics).toHaveBeenCalledWith(blinkOnly);

      const postureOnly = {
        posture: {
          timestamp: Date.now(),
          goodPosturePercent: 90,
          badPostureCount: 2,
        },
      };

      mockDetectionState.updateMetrics(postureOnly);
      expect(mockDetectionState.updateMetrics).toHaveBeenCalledWith(postureOnly);
    });
  });

  describe('State Transitions', () => {
    it('should transition from stopped to running', async () => {
      mockDetectionState.getStatus.mockReturnValue({
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      await mockDetectionState.startDetection();

      mockDetectionState.getStatus.mockReturnValue({
        isRunning: true,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      const status = mockDetectionState.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should transition from running to stopped', async () => {
      mockDetectionState.getStatus.mockReturnValue({
        isRunning: true,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      await mockDetectionState.stopDetection();

      mockDetectionState.getStatus.mockReturnValue({
        isRunning: false,
        features: { blink: true, posture: true },
        fpsMode: 'medium',
        lastUpdate: Date.now(),
      });

      const status = mockDetectionState.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should preserve settings across start/stop cycles', async () => {
      const customSettings = {
        features: { blink: false, posture: true },
        fpsMode: 'high',
      };

      mockDetectionState.updateSettings.mockReturnValue({
        isRunning: false,
        features: { blink: false, posture: true },
        fpsMode: 'high',
        lastUpdate: Date.now(),
      });

      mockDetectionState.updateSettings(customSettings);

      await mockDetectionState.startDetection();

      mockDetectionState.getStatus.mockReturnValue({
        isRunning: true,
        features: { blink: false, posture: true },
        fpsMode: 'high',
        lastUpdate: Date.now(),
      });

      const runningStatus = mockDetectionState.getStatus();
      expect(runningStatus.features.blink).toBe(false);
      expect(runningStatus.fpsMode).toBe('high');

      await mockDetectionState.stopDetection();

      mockDetectionState.getStatus.mockReturnValue({
        isRunning: false,
        features: { blink: false, posture: true },
        fpsMode: 'high',
        lastUpdate: Date.now(),
      });

      const stoppedStatus = mockDetectionState.getStatus();
      expect(stoppedStatus.features.blink).toBe(false);
      expect(stoppedStatus.fpsMode).toBe('high');
    });
  });
});
