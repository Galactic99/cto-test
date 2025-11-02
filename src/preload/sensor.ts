import { contextBridge, ipcRenderer } from 'electron';
import { DetectionSettings } from '../types/settings';
import { DetectionMetrics } from '../types/detection';

export interface SensorAPI {
  onStartCamera: (callback: () => void) => void;
  onStopCamera: (callback: () => void) => void;
  notifyCameraError: (error: string) => void;
  notifyCameraStarted: () => void;
  notifyCameraStopped: () => void;
  onDetectionConfigure: (callback: (config: Partial<DetectionSettings>) => void) => void;
  sendMetricsUpdate: (metrics: DetectionMetrics) => void;
}

const sensorAPI: SensorAPI = {
  onStartCamera: (callback: () => void) => {
    ipcRenderer.on('sensor:start-camera', () => callback());
  },
  onStopCamera: (callback: () => void) => {
    ipcRenderer.on('sensor:stop-camera', () => callback());
  },
  notifyCameraError: (error: string) => {
    ipcRenderer.send('sensor:camera-error', error);
  },
  notifyCameraStarted: () => {
    ipcRenderer.send('sensor:camera-started');
  },
  notifyCameraStopped: () => {
    ipcRenderer.send('sensor:camera-stopped');
  },
  onDetectionConfigure: (callback: (config: Partial<DetectionSettings>) => void) => {
    ipcRenderer.on('detection:configure', (_event, config: Partial<DetectionSettings>) =>
      callback(config)
    );
  },
  sendMetricsUpdate: (metrics: DetectionMetrics) => {
    ipcRenderer.send('sensor:metrics-update', metrics);
  },
};

contextBridge.exposeInMainWorld('sensorAPI', sensorAPI);
