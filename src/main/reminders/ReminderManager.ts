export class ReminderManager {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private callback: () => void;
  private isRunning: boolean = false;

  constructor(intervalMinutes: number, callback: () => void) {
    this.intervalMs = intervalMinutes * 60 * 1000;
    this.callback = callback;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  updateInterval(intervalMinutes: number): void {
    this.intervalMs = intervalMinutes * 60 * 1000;

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  private scheduleNext(): void {
    if (!this.isRunning) {
      return;
    }

    this.timer = setTimeout(() => {
      this.callback();
      this.scheduleNext();
    }, this.intervalMs);
  }
}
