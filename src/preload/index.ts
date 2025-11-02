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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
