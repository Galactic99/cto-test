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

export interface DetectionSettings {
  enabled: boolean;
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
  },
};
