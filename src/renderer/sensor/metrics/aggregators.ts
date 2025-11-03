export interface BlinkEvent {
  timestamp: number;
}

export interface BlinkRateMetrics {
  blinksPerMinute: number;
  eventCount: number;
  windowDurationMs: number;
}

export class BlinkRateAggregator {
  private events: BlinkEvent[] = [];
  private readonly windowDurationMs: number;

  constructor(windowDurationMinutes: number = 3) {
    this.windowDurationMs = windowDurationMinutes * 60 * 1000;
  }

  public addEvent(timestamp: number): void {
    this.events.push({ timestamp });
    this.cleanupOldEvents(timestamp);
  }

  public getMetrics(currentTime: number = Date.now()): BlinkRateMetrics {
    this.cleanupOldEvents(currentTime);

    const eventCount = this.events.length;

    let blinksPerMinute = 0;
    if (this.events.length >= 2) {
      const oldestEvent = this.events[0];
      const actualWindowMs = currentTime - oldestEvent.timestamp;
      const actualWindowMinutes = actualWindowMs / 60000;

      if (actualWindowMinutes > 0) {
        blinksPerMinute = eventCount / actualWindowMinutes;
      }
    } else if (this.events.length === 1) {
      const singleEventAge = currentTime - this.events[0].timestamp;
      if (singleEventAge < this.windowDurationMs) {
        blinksPerMinute = 1 / (singleEventAge / 60000);
      }
    }

    return {
      blinksPerMinute,
      eventCount,
      windowDurationMs: this.windowDurationMs,
    };
  }

  public reset(): void {
    this.events = [];
  }

  public getEventCount(): number {
    return this.events.length;
  }

  private cleanupOldEvents(currentTime: number): void {
    const cutoffTime = currentTime - this.windowDurationMs;
    this.events = this.events.filter((event) => event.timestamp > cutoffTime);
  }
}

export function createBlinkRateAggregator(
  windowDurationMinutes: number = 3
): BlinkRateAggregator {
  return new BlinkRateAggregator(windowDurationMinutes);
}
