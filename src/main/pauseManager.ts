import { getSettingsWindow } from './window';

export interface PauseState {
  isPaused: boolean;
  pausedUntil: number | null;
}

class PauseManager {
  private isPaused: boolean = false;
  private pausedUntil: number | null = null;
  private resumeTimer: NodeJS.Timeout | null = null;
  private listeners: Array<(state: PauseState) => void> = [];

  constructor() {}

  public pause(durationMinutes: number): void {
    if (this.isPaused) {
      console.log('[PauseManager] Already paused, extending duration');
    }

    this.isPaused = true;
    this.pausedUntil = Date.now() + durationMinutes * 60 * 1000;

    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
    }

    this.resumeTimer = setTimeout(() => {
      this.resume();
    }, durationMinutes * 60 * 1000);

    console.log(
      `[PauseManager] Paused all notifications for ${durationMinutes} minutes until ${new Date(this.pausedUntil).toLocaleTimeString()}`
    );

    this.notifyListeners();
    this.notifyUI();
  }

  public resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.pausedUntil = null;

    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }

    console.log('[PauseManager] Resumed all notifications');

    this.notifyListeners();
    this.notifyUI();
  }

  public getState(): PauseState {
    return {
      isPaused: this.isPaused,
      pausedUntil: this.pausedUntil,
    };
  }

  public subscribe(listener: (state: PauseState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private notifyUI(): void {
    const settingsWindow = getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('pause:state-changed', this.getState());
    }
  }

  public cleanup(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    this.listeners = [];
    this.isPaused = false;
    this.pausedUntil = null;
  }
}

export const pauseManager = new PauseManager();
