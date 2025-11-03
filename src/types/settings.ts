export interface BlinkSettings {
  enabled: boolean;
  interval: number; // minutes
}

export interface PostureSettings {
  enabled: boolean;
  interval: number; // minutes
}

export interface AppPreferences {
  startOnLogin: boolean;
}

export type FpsMode = 'battery' | 'balanced' | 'accurate';

export interface DetectionFeatures {
  blink: boolean;
  posture: boolean;
}

export interface IdleDetectionSettings {
  enabled: boolean;
  thresholdMinutes: number;
}

export interface DetectionSettings {
  enabled: boolean;
  features?: DetectionFeatures;
  fpsMode?: FpsMode;
  privacyConsentGiven?: boolean;
  postureScoreThreshold?: number;
  postureBaselinePitch?: number;
  postureCalibrationTimestamp?: number;
  idleDetection?: IdleDetectionSettings;
}

export type NotificationPosition = 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';

export interface NotificationSettings {
  position: NotificationPosition;
  timeout: number; // milliseconds
  soundEnabled: boolean;
}

export interface AppSettings {
  blink: BlinkSettings;
  posture: PostureSettings;
  app: AppPreferences;
  detection: DetectionSettings;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
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
    features: {
      blink: true,
      posture: true,
    },
    fpsMode: 'balanced',
    privacyConsentGiven: false,
    postureScoreThreshold: 45,
    postureBaselinePitch: undefined,
    postureCalibrationTimestamp: undefined,
    idleDetection: {
      enabled: true,
      thresholdMinutes: 5,
    },
  },
  notifications: {
    position: 'top-right',
    timeout: 5000,
    soundEnabled: true,
  },
};
