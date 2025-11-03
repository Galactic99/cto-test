import { DetectionSettings, DetectionFeatures, FpsMode } from '../types/settings';
import { DetectionStatus, DetectionMetrics, DetectionError } from '../types/detection';
import * as sensorWindow from './sensorWindow';
import { getSettings } from './store/settings';

interface DetectionState {
  isRunning: boolean;
  features: DetectionFeatures;
  fpsMode: FpsMode;
  metrics: DetectionMetrics;
  error?: DetectionError;
}

const defaultFeatures: DetectionFeatures = {
  blink: true,
  posture: true,
};

let state: DetectionState = {
  isRunning: false,
  features: { ...defaultFeatures },
  fpsMode: 'balanced',
  metrics: {},
};

export function getStatus(): DetectionStatus {
  return {
    isRunning: state.isRunning,
    features: { ...state.features },
    fpsMode: state.fpsMode,
    lastUpdate: Date.now(),
    error: state.error,
  };
}

export function getMetrics(): DetectionMetrics {
  return {
    ...state.metrics,
  };
}

export function updateMetrics(metrics: DetectionMetrics): void {
  if (metrics.blink) {
    state.metrics.blink = { ...metrics.blink };
  }
  if (metrics.posture) {
    state.metrics.posture = { ...metrics.posture };
  }
}

export async function startDetection(): Promise<void> {
  if (state.isRunning) {
    console.log('[DetectionState] Detection already running');
    return;
  }

  console.log('[DetectionState] Starting detection with features:', state.features);
  
  try {
    const window = sensorWindow.getSensorWindow();
    if (!window || window.isDestroyed()) {
      sensorWindow.createSensorWindow();
    }

    state.isRunning = true;
    
    const settings = getSettings();
    
    // Send configuration to sensor window
    sensorWindow.sendToSensor('detection:configure', {
      features: state.features,
      fpsMode: state.fpsMode,
      postureBaselinePitch: settings.detection.postureBaselinePitch,
    });
    
    // Start the camera
    await sensorWindow.startCamera();
    
    console.log('[DetectionState] Detection started successfully');
  } catch (error) {
    state.isRunning = false;
    console.error('[DetectionState] Failed to start detection:', error);
    throw error;
  }
}

export async function stopDetection(): Promise<void> {
  if (!state.isRunning) {
    console.log('[DetectionState] Detection already stopped');
    return;
  }

  console.log('[DetectionState] Stopping detection');
  
  try {
    await sensorWindow.stopCamera();
    state.isRunning = false;
    
    console.log('[DetectionState] Detection stopped successfully');
  } catch (error) {
    console.error('[DetectionState] Failed to stop detection:', error);
    throw error;
  }
}

export function updateSettings(settings: Partial<DetectionSettings>): DetectionStatus {
  console.log('[DetectionState] Updating settings:', settings);
  
  const wasRunning = state.isRunning;
  
  if (settings.features) {
    state.features = {
      ...state.features,
      ...settings.features,
    };
  }
  
  if (settings.fpsMode) {
    state.fpsMode = settings.fpsMode;
  }
  
  // If detection is running, send updated configuration to sensor window
  if (wasRunning && state.isRunning) {
    const currentSettings = getSettings();
    sensorWindow.sendToSensor('detection:configure', {
      features: state.features,
      fpsMode: state.fpsMode,
      postureBaselinePitch: currentSettings.detection.postureBaselinePitch,
    });
  }
  
  return getStatus();
}

export function resetState(): void {
  state = {
    isRunning: false,
    features: { ...defaultFeatures },
    fpsMode: 'balanced',
    metrics: {},
  };
}

export function isDetectionRunning(): boolean {
  return state.isRunning;
}

export function setDetectionError(error: DetectionError): void {
  state.error = error;
  console.log('[DetectionState] Detection error set:', error);
}

export function clearDetectionError(): void {
  if (state.error) {
    console.log('[DetectionState] Clearing detection error');
    state.error = undefined;
  }
}
