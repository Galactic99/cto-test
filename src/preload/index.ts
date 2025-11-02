import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings } from '../types/settings';

export interface ElectronAPI {
  platform: string;
  settings: {
    get: () => Promise<AppSettings>;
    set: (partialSettings: Partial<AppSettings>) => Promise<AppSettings>;
  };
  reminder: {
    testBlink: () => Promise<void>;
    testPosture: () => Promise<void>;
  };
  autostart: {
    toggle: (enabled: boolean) => Promise<void>;
  };
  sensor: {
    enableDetection: () => Promise<void>;
    disableDetection: () => Promise<void>;
    startCamera: () => Promise<void>;
    stopCamera: () => Promise<void>;
    onCameraError: (callback: (error: string) => void) => void;
    onCameraStarted: (callback: () => void) => void;
    onCameraStopped: (callback: () => void) => void;
  };
}

const electronAPI: ElectronAPI = {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partialSettings: Partial<AppSettings>) =>
      ipcRenderer.invoke('settings:set', partialSettings),
  },
  reminder: {
    testBlink: () => ipcRenderer.invoke('reminder:test-blink'),
    testPosture: () => ipcRenderer.invoke('reminder:test-posture'),
  },
  autostart: {
    toggle: (enabled: boolean) => ipcRenderer.invoke('autostart:toggle', enabled),
  },
  sensor: {
    enableDetection: () => ipcRenderer.invoke('sensor:enable-detection'),
    disableDetection: () => ipcRenderer.invoke('sensor:disable-detection'),
    startCamera: () => ipcRenderer.invoke('sensor:start-camera'),
    stopCamera: () => ipcRenderer.invoke('sensor:stop-camera'),
    onCameraError: (callback: (error: string) => void) => {
      ipcRenderer.on('sensor:camera-error', (_event, error: string) => callback(error));
    },
    onCameraStarted: (callback: () => void) => {
      ipcRenderer.on('sensor:camera-started', () => callback());
    },
    onCameraStopped: (callback: () => void) => {
      ipcRenderer.on('sensor:camera-stopped', () => callback());
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
