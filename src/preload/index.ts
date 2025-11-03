import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, DetectionSettings } from '../types/settings';
import { DetectionMetrics, DetectionStatus, DetectionError } from '../types/detection';

export interface PauseState {
  isPaused: boolean;
  pausedUntil: number | null;
}

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
    onDetectionError: (callback: (error: DetectionError) => void) => void;
    onCameraStarted: (callback: () => void) => void;
    onCameraStopped: (callback: () => void) => void;
  };
  detection: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getStatus: () => Promise<DetectionStatus>;
    getMetrics: () => Promise<DetectionMetrics>;
    setSettings: (settings: Partial<DetectionSettings>) => Promise<DetectionStatus>;
    calibratePosture: () => Promise<void>;
    retry: () => Promise<void>;
    onMetricsUpdated: (callback: (metrics: DetectionMetrics) => void) => void;
  };
  pause: {
    getState: () => Promise<PauseState>;
    toggle: (durationMinutes: number) => Promise<void>;
    resume: () => Promise<void>;
    onStateChanged: (callback: (state: PauseState) => void) => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  docs: {
    getCameraPermissionsPath: () => Promise<string>;
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
    onDetectionError: (callback: (error: DetectionError) => void) => {
      ipcRenderer.on('sensor:detection-error', (_event, error: DetectionError) => callback(error));
    },
    onCameraStarted: (callback: () => void) => {
      ipcRenderer.on('sensor:camera-started', () => callback());
    },
    onCameraStopped: (callback: () => void) => {
      ipcRenderer.on('sensor:camera-stopped', () => callback());
    },
  },
  detection: {
    start: () => ipcRenderer.invoke('detection:start'),
    stop: () => ipcRenderer.invoke('detection:stop'),
    getStatus: () => ipcRenderer.invoke('detection:status'),
    getMetrics: () => ipcRenderer.invoke('detection:metrics:get'),
    setSettings: (settings: Partial<DetectionSettings>) =>
      ipcRenderer.invoke('detection:settings:set', settings),
    calibratePosture: () => ipcRenderer.invoke('detection:calibrate:posture'),
    retry: () => ipcRenderer.invoke('detection:retry'),
    onMetricsUpdated: (callback: (metrics: DetectionMetrics) => void) => {
      ipcRenderer.on('detection:metrics-updated', (_event, metrics: DetectionMetrics) =>
        callback(metrics)
      );
    },
  },
  pause: {
    getState: () => ipcRenderer.invoke('pause:get-state'),
    toggle: (durationMinutes: number) => ipcRenderer.invoke('pause:toggle', durationMinutes),
    resume: () => ipcRenderer.invoke('pause:resume'),
    onStateChanged: (callback: (state: PauseState) => void) => {
      ipcRenderer.on('pause:state-changed', (_event, state: PauseState) => callback(state));
    },
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  docs: {
    getCameraPermissionsPath: () => ipcRenderer.invoke('docs:get-camera-permissions-path'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
