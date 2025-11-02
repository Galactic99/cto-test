import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DetectionSettings from '../src/renderer/components/DetectionSettings';
import { AppSettings } from '../src/types/settings';

const mockSettingsWithoutConsent: AppSettings = {
  blink: { enabled: true, interval: 20 },
  posture: { enabled: true, interval: 30 },
  app: { startOnLogin: false },
  detection: {
    enabled: false,
    features: { blink: true, posture: true },
    fpsMode: 'medium',
    privacyConsentGiven: false,
  },
};

let currentMockSettings = { ...mockSettingsWithoutConsent };

const mockElectronAPI = {
  platform: 'darwin',
  settings: {
    get: jest.fn().mockImplementation(() => Promise.resolve({ ...currentMockSettings })),
    set: jest.fn().mockImplementation((partial) => {
      if (partial.detection) {
        currentMockSettings.detection = {
          ...currentMockSettings.detection,
          ...partial.detection,
        };
      }
      return Promise.resolve({ ...currentMockSettings });
    }),
  },
  reminder: {
    testBlink: jest.fn().mockResolvedValue(undefined),
    testPosture: jest.fn().mockResolvedValue(undefined),
  },
  autostart: {
    toggle: jest.fn().mockResolvedValue(undefined),
  },
  sensor: {
    enableDetection: jest.fn().mockResolvedValue(undefined),
    disableDetection: jest.fn().mockResolvedValue(undefined),
    startCamera: jest.fn().mockResolvedValue(undefined),
    stopCamera: jest.fn().mockResolvedValue(undefined),
    onCameraError: jest.fn(),
    onCameraStarted: jest.fn(),
    onCameraStopped: jest.fn(),
  },
  detection: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({
      isRunning: false,
      features: { blink: true, posture: true },
      fpsMode: 'medium',
      lastUpdate: Date.now(),
    }),
    getMetrics: jest.fn().mockResolvedValue({}),
    setSettings: jest.fn().mockResolvedValue({
      isRunning: false,
      features: { blink: true, posture: true },
      fpsMode: 'medium',
      lastUpdate: Date.now(),
    }),
    calibratePosture: jest.fn().mockResolvedValue(undefined),
    onMetricsUpdated: jest.fn(),
  },
};

beforeAll(() => {
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

beforeEach(() => {
  jest.clearAllMocks();
  currentMockSettings = { ...mockSettingsWithoutConsent };
  currentMockSettings.detection = {
    enabled: false,
    features: { blink: true, posture: true },
    fpsMode: 'medium',
    privacyConsentGiven: false,
  };
});

describe('Privacy Consent Flow', () => {
  it('shows privacy note when enabling detection without consent', async () => {
    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    });

    const masterToggle = screen.getByLabelText('Enable camera-based detection') as HTMLInputElement;
    expect(masterToggle.checked).toBe(false);

    fireEvent.click(masterToggle);

    await waitFor(() => {
      expect(screen.getByText('Privacy Notice: Camera Access')).toBeInTheDocument();
    });

    expect(screen.getByText(/All camera processing happens locally/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable Detection/i)).toBeInTheDocument();
  });

  it('blocks detection without checking consent checkbox', async () => {
    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Enable camera-based detection'));

    await waitFor(() => {
      expect(screen.getByText('Privacy Notice: Camera Access')).toBeInTheDocument();
    });

    const enableButton = screen.getByText('Enable Detection') as HTMLButtonElement;
    expect(enableButton.disabled).toBe(true);
  });

  it('enables detection after consent is given', async () => {
    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Enable camera-based detection'));

    await waitFor(() => {
      expect(screen.getByText('Privacy Notice: Camera Access')).toBeInTheDocument();
    });

    const consentCheckbox = screen.getByRole('checkbox', {
      name: /I understand and consent/i,
    }) as HTMLInputElement;
    fireEvent.click(consentCheckbox);

    const enableButton = screen.getByText('Enable Detection') as HTMLButtonElement;
    expect(enableButton.disabled).toBe(false);

    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockElectronAPI.settings.set).toHaveBeenCalledWith({
        detection: expect.objectContaining({
          enabled: true,
          privacyConsentGiven: true,
        }),
      });
    });
  });

  it('closes privacy note on cancel without enabling detection', async () => {
    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Enable camera-based detection'));

    await waitFor(() => {
      expect(screen.getByText('Privacy Notice: Camera Access')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Privacy Notice: Camera Access')).not.toBeInTheDocument();
    });

    expect(mockElectronAPI.settings.set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        detection: expect.objectContaining({ enabled: true }),
      })
    );
  });

  it('shows consent granted status when consent is already given', async () => {
    currentMockSettings.detection.privacyConsentGiven = true;
    currentMockSettings.detection.enabled = true;

    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('✓ Camera consent granted')).toBeInTheDocument();
    });

    expect(screen.getByText('Revoke Consent')).toBeInTheDocument();
  });

  it('allows revoking consent', async () => {
    currentMockSettings.detection.privacyConsentGiven = true;
    currentMockSettings.detection.enabled = true;

    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Revoke Consent')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revoke Consent'));

    await waitFor(() => {
      expect(mockElectronAPI.settings.set).toHaveBeenCalledWith({
        detection: expect.objectContaining({
          enabled: false,
          privacyConsentGiven: false,
        }),
      });
    });
  });

  it('does not revoke consent if user cancels confirmation', async () => {
    currentMockSettings.detection.privacyConsentGiven = true;
    currentMockSettings.detection.enabled = true;

    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Revoke Consent')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revoke Consent'));

    await waitFor(() => {
      expect(mockElectronAPI.settings.set).not.toHaveBeenCalled();
    });
  });

  it('shows warning when enabled without consent', async () => {
    currentMockSettings.detection.enabled = true;
    currentMockSettings.detection.privacyConsentGiven = false;

    render(<DetectionSettings />);

    await waitFor(() => {
      expect(
        screen.getByText(/Privacy consent required/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Review Privacy & Grant Consent')).toBeInTheDocument();
  });

  it('starts detection only when consent is given', async () => {
    currentMockSettings.detection.enabled = false;
    currentMockSettings.detection.privacyConsentGiven = true;
    mockElectronAPI.detection.getStatus.mockResolvedValue({
      isRunning: false,
      features: { blink: true, posture: true },
      fpsMode: 'medium',
      lastUpdate: Date.now(),
    });

    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    });

    const masterToggle = screen.getByLabelText('Enable camera-based detection') as HTMLInputElement;
    fireEvent.click(masterToggle);

    await waitFor(
      () => {
        expect(mockElectronAPI.detection.start).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it('stops camera immediately when detection is disabled', async () => {
    currentMockSettings.detection.enabled = true;
    currentMockSettings.detection.privacyConsentGiven = true;
    mockElectronAPI.detection.getStatus.mockResolvedValue({
      isRunning: true,
      features: { blink: true, posture: true },
      fpsMode: 'medium',
      lastUpdate: Date.now(),
    });

    render(<DetectionSettings />);

    await waitFor(() => {
      expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    });

    const masterToggle = screen.getByLabelText('Enable camera-based detection') as HTMLInputElement;

    fireEvent.click(masterToggle);

    await waitFor(() => {
      expect(mockElectronAPI.detection.stop).toHaveBeenCalled();
    });
  });
});
