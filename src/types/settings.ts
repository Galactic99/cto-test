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

export type FpsMode = 'low' | 'medium' | 'high';

export interface DetectionFeatures {
  blink: boolean;
  posture: boolean;
}

export interface DetectionSettings {
  enabled: boolean;
  features?: DetectionFeatures;
  fpsMode?: FpsMode;
  privacyConsentGiven?: boolean;
}

export interface AppSettings {
  blink: BlinkSettings;
  posture: PostureSettings;
  app: AppPreferences;
  detection: DetectionSettings;
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
    fpsMode: 'medium',
    privacyConsentGiven: false,
  },
};
