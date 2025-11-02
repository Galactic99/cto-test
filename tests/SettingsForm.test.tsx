import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsForm from '../src/renderer/components/SettingsForm';
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

describe('SettingsForm Component', () => {
  it('renders loading state initially', () => {
    render(<SettingsForm />);
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('loads and displays settings', async () => {
    render(<SettingsForm />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Reminder Settings')).toBeInTheDocument();
    });
    
    expect(mockElectronAPI.settings.get).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Blink Reminder')).toBeInTheDocument();
    expect(screen.getByText('Posture Reminder')).toBeInTheDocument();
  });

  it('renders all form controls', async () => {
    render(<SettingsForm />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Reminder Settings')).toBeInTheDocument();
    });
    
    expect(screen.getByLabelText('Enable blink reminder')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable posture reminder')).toBeInTheDocument();
    expect(screen.getByLabelText('Start on login')).toBeInTheDocument();
    expect(screen.getByText('Test Blink Notification')).toBeInTheDocument();
    expect(screen.getByText('Test Posture Notification')).toBeInTheDocument();
  });

  it('calls testBlink when Test Blink Notification button is clicked', async () => {
    render(<SettingsForm />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Blink Notification')).toBeInTheDocument();
    });
    
    const testButton = screen.getByText('Test Blink Notification');
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.reminder.testBlink).toHaveBeenCalledTimes(1);
    });
  });

  it('calls testPosture when Test Posture Notification button is clicked', async () => {
    render(<SettingsForm />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Posture Notification')).toBeInTheDocument();
    });
    
    const testButton = screen.getByText('Test Posture Notification');
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.reminder.testPosture).toHaveBeenCalledTimes(1);
    });
  });

  it('updates settings when checkboxes are toggled', async () => {
    render(<SettingsForm />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Enable blink reminder')).toBeInTheDocument();
    });
    
    const blinkCheckbox = screen.getByLabelText('Enable blink reminder') as HTMLInputElement;
    expect(blinkCheckbox.checked).toBe(true);
    
    fireEvent.click(blinkCheckbox);
    
    await waitFor(() => {
      expect(mockElectronAPI.settings.set).toHaveBeenCalledWith({
        blinkReminderEnabled: false,
      });
    });
  });

  it('validates interval input boundaries', async () => {
    render(<SettingsForm />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Reminder Settings')).toBeInTheDocument();
    });
    
    const intervalInputs = screen.getAllByDisplayValue('20');
    const blinkIntervalInput = intervalInputs[0];
    
    fireEvent.change(blinkIntervalInput, { target: { value: '250' } });
    
    await waitFor(() => {
      expect(mockElectronAPI.settings.set).not.toHaveBeenCalledWith({
        blinkInterval: 250,
      });
    });
  });
});
