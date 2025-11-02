import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/renderer/App';
import { AppSettings } from '../src/types/settings';

const mockSettings: AppSettings = {
  blinkReminderEnabled: true,
  blinkInterval: 20,
  postureReminderEnabled: true,
  postureInterval: 30,
  startOnLogin: false,
};

const mockElectronAPI = {
  platform: 'darwin',
  settings: {
    get: jest.fn().mockResolvedValue(mockSettings),
    set: jest.fn().mockImplementation((partial) => 
      Promise.resolve({ ...mockSettings, ...partial })
    ),
  },
  reminder: {
    testBlink: jest.fn().mockResolvedValue(undefined),
    testPosture: jest.fn().mockResolvedValue(undefined),
  },
  autostart: {
    toggle: jest.fn().mockResolvedValue(undefined),
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
