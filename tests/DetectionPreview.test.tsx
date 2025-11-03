import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import DetectionPreview from '../src/renderer/components/DetectionPreview';
import { DetectionMetrics } from '../src/types/detection';

const mockGetMetrics = jest.fn();

const mockElectronAPI = {
  platform: 'darwin',
  settings: {
    get: jest.fn(),
    set: jest.fn(),
  },
  reminder: {
    testBlink: jest.fn(),
    testPosture: jest.fn(),
  },
  autostart: {
    toggle: jest.fn(),
  },
  sensor: {
    enableDetection: jest.fn(),
    disableDetection: jest.fn(),
    startCamera: jest.fn(),
    stopCamera: jest.fn(),
    onCameraError: jest.fn(),
    onCameraStarted: jest.fn(),
    onCameraStopped: jest.fn(),
  },
  detection: {
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(),
    getMetrics: mockGetMetrics,
    setSettings: jest.fn(),
    calibratePosture: jest.fn(),
    onMetricsUpdated: jest.fn(),
  },
};

const mockMetricsHealthy: DetectionMetrics = {
  blink: {
    timestamp: Date.now(),
    blinkCount: 20,
    blinkRate: 18.5,
    lastBlinkTime: Date.now() - 3000,
  },
  posture: {
    timestamp: Date.now(),
    postureScore: 85,
    headPitchAngle: 10,
    currentPosture: 'good',
  },
};

const mockMetricsWarning: DetectionMetrics = {
  blink: {
    timestamp: Date.now(),
    blinkCount: 5,
    blinkRate: 7.2,
    lastBlinkTime: Date.now() - 8000,
  },
  posture: {
    timestamp: Date.now(),
    postureScore: 55,
    headPitchAngle: 25,
    currentPosture: 'bad',
  },
};

const mockMetricsPoor: DetectionMetrics = {
  blink: {
    timestamp: Date.now(),
    blinkCount: 35,
    blinkRate: 32.0,
    lastBlinkTime: Date.now() - 1000,
  },
  posture: {
    timestamp: Date.now(),
    postureScore: 30,
    headPitchAngle: 40,
    currentPosture: 'bad',
  },
};

beforeAll(() => {
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMetrics.mockResolvedValue(mockMetricsHealthy);
  
  // Reset document.hidden to default state
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => false,
  });
});

describe('DetectionPreview Component', () => {
  describe('when detection is not running', () => {
    it('renders placeholder message', () => {
      render(<DetectionPreview isDetectionRunning={false} />);
      
      expect(screen.getByText('Live Detection Preview')).toBeInTheDocument();
      expect(screen.getByText(/Detection is not running/)).toBeInTheDocument();
      expect(mockGetMetrics).not.toHaveBeenCalled();
    });

    it('does not poll for metrics', async () => {
      render(<DetectionPreview isDetectionRunning={false} />);
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      expect(mockGetMetrics).not.toHaveBeenCalled();
    });
  });

  describe('when detection is running', () => {
    it('shows loading state initially', () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      expect(screen.getByText('Live Detection Preview')).toBeInTheDocument();
      expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
    });

    it('fetches metrics immediately on mount', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });
    });

    it('displays healthy blink rate with green status', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/18.5/)).toBeInTheDocument();
      });
      
      expect(screen.getByText('blinks/min')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('displays good posture score with green status', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/85/)).toBeInTheDocument();
      });
      
      expect(screen.getByText('/ 100')).toBeInTheDocument();
      expect(screen.getByText('Good posture')).toBeInTheDocument();
    });

    it('displays warning status for low blink rate', async () => {
      mockGetMetrics.mockResolvedValue(mockMetricsWarning);
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/7.2/)).toBeInTheDocument();
      });
      
      expect(screen.getByText('Check eye strain')).toBeInTheDocument();
    });

    it('displays warning status for fair posture score', async () => {
      mockGetMetrics.mockResolvedValue(mockMetricsWarning);
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Fair posture')).toBeInTheDocument();
      });
      
      expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    it('displays poor status for very low posture score', async () => {
      mockGetMetrics.mockResolvedValue(mockMetricsPoor);
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/30/)).toBeInTheDocument();
      });
      
      expect(screen.getByText('Poor posture')).toBeInTheDocument();
    });

    it('displays "No data available" when blink metrics are missing', async () => {
      mockGetMetrics.mockResolvedValue({
        posture: mockMetricsHealthy.posture,
      });
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        const noDataElements = screen.getAllByText('No data available');
        expect(noDataElements.length).toBeGreaterThan(0);
      });
      
      expect(screen.getByText('Good posture')).toBeInTheDocument();
    });

    it('displays "No data available" when posture metrics are missing', async () => {
      mockGetMetrics.mockResolvedValue({
        blink: mockMetricsHealthy.blink,
      });
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        const noDataElements = screen.getAllByText('No data available');
        expect(noDataElements.length).toBeGreaterThan(0);
      });
      
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('shows last updated timestamp', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });

    it('polls for metrics at regular intervals', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(2);
      });
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(3);
      });
    });

    it('handles API errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockGetMetrics.mockRejectedValue(new Error('API error'));
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalled();
      });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[DetectionPreview] Failed to fetch metrics:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('cleanup and lifecycle', () => {
    it('stops polling when component unmounts', async () => {
      const { unmount } = render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });
      
      unmount();
      
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      
      expect(mockGetMetrics).toHaveBeenCalledTimes(1);
    });

    it('resets metrics when detection stops', async () => {
      const { rerender } = render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/18.5/)).toBeInTheDocument();
      });
      
      rerender(<DetectionPreview isDetectionRunning={false} />);
      
      expect(screen.getByText(/Detection is not running/)).toBeInTheDocument();
      expect(screen.queryByText(/18.5/)).not.toBeInTheDocument();
    });

    it('resumes polling when detection starts again', async () => {
      const { rerender } = render(<DetectionPreview isDetectionRunning={false} />);
      
      expect(mockGetMetrics).not.toHaveBeenCalled();
      
      rerender(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('window visibility handling', () => {
    it('pauses polling when window is hidden', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });
      
      const callCountBeforeHiding = mockGetMetrics.mock.calls.length;
      
      // Simulate window being hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      // Advance time and ensure no new calls are made
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      // Call count should remain the same
      expect(mockGetMetrics.mock.calls.length).toBe(callCountBeforeHiding);
    });

    it('resumes polling when window becomes visible again', async () => {
      // Start with window visible, then hide it
      render(<DetectionPreview isDetectionRunning={true} />);
      
      // Wait for initial call
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });
      
      // Hide window
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      // Advance time while hidden - should not make more calls
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      const callCountWhileHidden = mockGetMetrics.mock.calls.length;
      
      // Make window visible again
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      
      // Dispatch visibility change and wait for polling to resume
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      
      // Should now fetch metrics after becoming visible
      await waitFor(() => {
        expect(mockGetMetrics.mock.calls.length).toBeGreaterThan(callCountWhileHidden);
      });
    });
  });

  describe('status indicators', () => {
    it('shows healthy ranges information', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Healthy ranges:/)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/12-25 blinks\/min/)).toBeInTheDocument();
      expect(screen.getByText(/≥ 70 for good posture/)).toBeInTheDocument();
    });

    it('displays healthy status with appropriate indicator', async () => {
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Good posture')).toBeInTheDocument();
    });

    it('displays warning status with appropriate indicator', async () => {
      mockGetMetrics.mockResolvedValue(mockMetricsWarning);
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Check eye strain')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Fair posture')).toBeInTheDocument();
    });

    it('displays poor status with appropriate indicator', async () => {
      mockGetMetrics.mockResolvedValue(mockMetricsPoor);
      
      render(<DetectionPreview isDetectionRunning={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Poor posture')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Check eye strain')).toBeInTheDocument();
    });
  });
});
