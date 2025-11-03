import { contextBridge, ipcRenderer } from 'electron';
import { DetectionSettings } from '../types/settings';
import { DetectionMetrics, DetectionError } from '../types/detection';

export interface SensorAPI {
  onStartCamera: (callback: () => void) => void;
  onStopCamera: (callback: () => void) => void;
  notifyCameraError: (error: string) => void;
  notifyDetectionError: (error: DetectionError) => void;
  notifyCameraStarted: () => void;
  notifyCameraStopped: () => void;
  onDetectionConfigure: (
    callback: (config: {
      features: DetectionSettings['features'];
      fpsMode: DetectionSettings['fpsMode'];
      postureBaselinePitch?: number;
    }) => void
  ) => void;
  sendMetricsUpdate: (metrics: DetectionMetrics) => void;
  onCalibratePosture: (callback: () => void) => void;
  sendCalibrationResult: (baseline: number) => void;
  onRetryDetection: (callback: () => void) => void;
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
  notifyDetectionError: (error: DetectionError) => {
    ipcRenderer.send('sensor:detection-error', error);
  },
  notifyCameraStarted: () => {
    ipcRenderer.send('sensor:camera-started');
  },
  notifyCameraStopped: () => {
    ipcRenderer.send('sensor:camera-stopped');
  },
  onDetectionConfigure: (
    callback: (config: {
      features: DetectionSettings['features'];
      fpsMode: DetectionSettings['fpsMode'];
      postureBaselinePitch?: number;
    }) => void
  ) => {
    ipcRenderer.on(
      'detection:configure',
      (
        _event,
        config: {
          features: DetectionSettings['features'];
          fpsMode: DetectionSettings['fpsMode'];
          postureBaselinePitch?: number;
        }
      ) => callback(config)
    );
  },
  sendMetricsUpdate: (metrics: DetectionMetrics) => {
    ipcRenderer.send('sensor:metrics-update', metrics);
  },
  onCalibratePosture: (callback: () => void) => {
    ipcRenderer.on('sensor:calibrate-posture', () => callback());
  },
  sendCalibrationResult: (baseline: number) => {
    ipcRenderer.send('sensor:calibration-result', baseline);
  },
  onRetryDetection: (callback: () => void) => {
    ipcRenderer.on('sensor:retry-detection', () => callback());
  },
};

contextBridge.exposeInMainWorld('sensorAPI', sensorAPI);
