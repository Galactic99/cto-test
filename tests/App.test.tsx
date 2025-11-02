import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/renderer/App';
import { AppSettings } from '../src/types/settings';

const mockSettings: AppSettings = {
  blink: {
    enabled: true,
    interval: 20,
  },
  posture: {
    enabled: true,
    interval: 30,
  },
  app: {
    startOnLogin: false,
  },
  detection: {
    enabled: false,
  },
};

const mockElectronAPI = {
  platform: 'darwin',
  settings: {
    get: jest.fn().mockResolvedValue(mockSettings),
    set: jest.fn().mockImplementation((partial) => {
      const updated = { ...mockSettings };
      if (partial.blink) updated.blink = { ...updated.blink, ...partial.blink };
      if (partial.posture) updated.posture = { ...updated.posture, ...partial.posture };
      if (partial.app) updated.app = { ...updated.app, ...partial.app };
      if (partial.detection) updated.detection = { ...updated.detection, ...partial.detection };
      return Promise.resolve(updated);
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
};

beforeAll(() => {
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('App Component', () => {
  it('renders settings form', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Reminder Settings')).toBeInTheDocument();
    });
  });
});
