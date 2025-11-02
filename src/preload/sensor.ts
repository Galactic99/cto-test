import { contextBridge, ipcRenderer } from 'electron';

export interface SensorAPI {
  onStartCamera: (callback: () => void) => void;
  onStopCamera: (callback: () => void) => void;
  notifyCameraError: (error: string) => void;
  notifyCameraStarted: () => void;
  notifyCameraStopped: () => void;
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
};

contextBridge.exposeInMainWorld('sensorAPI', sensorAPI);
