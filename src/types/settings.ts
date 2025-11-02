export interface AppSettings {
  blinkReminderEnabled: boolean;
  blinkInterval: number;
  postureReminderEnabled: boolean;
  postureInterval: number;
  startOnLogin: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  blinkReminderEnabled: true,
  blinkInterval: 20,
  postureReminderEnabled: true,
  postureInterval: 30,
  startOnLogin: false,
};
