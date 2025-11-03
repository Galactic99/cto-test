import { FpsMode } from '../../types/settings';

export interface LoopMetrics {
  currentFps: number;
  targetFps: number;
  avgProcessingTime: number;
  cpuUsagePercent: number;
  framesProcessed: number;
  framesSkipped: number;
  isThrottled: boolean;
  throttleReason?: string;
}

export interface ThrottleEvent {
  timestamp: number;
  reason: string;
  previousFps: number;
  newFps: number;
  cpuUsage: number;
}

export interface LoopConfig {
  fpsMode: FpsMode;
  skipFrames?: number;
  cpuThreshold?: number;
  cpuMonitorDuration?: number;
}

const FPS_MODES = {
  battery: 6,
  balanced: 10,
  accurate: 15,
} as const;

const DEFAULT_CONFIG = {
  skipFrames: 1,
  cpuThreshold: 8,
  cpuMonitorDuration: 10000,
};

export class DetectionLoop {
  private targetFps: number;
  private effectiveFps: number;
  private skipFrames: number;
  private frameCounter: number = 0;
  private frameInterval: number;
  private lastFrameTime: number = 0;
  private processingTimes: number[] = [];
  private cpuSamples: number[] = [];
  private cpuThreshold: number;
  private cpuMonitorDuration: number;
  private cpuCheckStartTime: number = 0;
  private isThrottled: boolean = false;
  private throttleEvents: ThrottleEvent[] = [];
  private framesProcessed: number = 0;
  private framesSkipped: number = 0;
  private lastMetricsTime: number = 0;
  private readonly MAX_PROCESSING_SAMPLES = 30;
  private readonly MAX_CPU_SAMPLES = 100;

  constructor(config: LoopConfig) {
    this.targetFps = FPS_MODES[config.fpsMode];
    this.effectiveFps = this.targetFps;
    this.frameInterval = 1000 / this.effectiveFps;
    this.skipFrames = config.skipFrames ?? DEFAULT_CONFIG.skipFrames;
    this.cpuThreshold = config.cpuThreshold ?? DEFAULT_CONFIG.cpuThreshold;
    this.cpuMonitorDuration = config.cpuMonitorDuration ?? DEFAULT_CONFIG.cpuMonitorDuration;
  }

  public updateConfig(config: Partial<LoopConfig>): void {
    if (config.fpsMode) {
      this.targetFps = FPS_MODES[config.fpsMode];
      if (!this.isThrottled) {
        this.effectiveFps = this.targetFps;
        this.frameInterval = 1000 / this.effectiveFps;
      }
    }
    if (config.skipFrames !== undefined) {
      this.skipFrames = config.skipFrames;
    }
    if (config.cpuThreshold !== undefined) {
      this.cpuThreshold = config.cpuThreshold;
    }
    if (config.cpuMonitorDuration !== undefined) {
      this.cpuMonitorDuration = config.cpuMonitorDuration;
    }
  }

  public shouldProcessFrame(now: number): boolean {
    const elapsed = now - this.lastFrameTime;

    if (elapsed < this.frameInterval) {
      return false;
    }

    this.lastFrameTime = now - (elapsed % this.frameInterval);
    this.frameCounter++;

    if (this.skipFrames > 1 && this.frameCounter % this.skipFrames !== 0) {
      this.framesSkipped++;
      return false;
    }

    return true;
  }

  public recordProcessingTime(startTime: number, endTime: number): void {
    const processingTime = endTime - startTime;
    this.processingTimes.push(processingTime);

    if (this.processingTimes.length > this.MAX_PROCESSING_SAMPLES) {
      this.processingTimes.shift();
    }

    this.framesProcessed++;
    this.updateCpuMetrics(processingTime);
  }

  private updateCpuMetrics(processingTime: number): void {
    const cpuUsage = (processingTime / this.frameInterval) * 100;
    this.cpuSamples.push(cpuUsage);

    if (this.cpuSamples.length > this.MAX_CPU_SAMPLES) {
      this.cpuSamples.shift();
    }

    const avgCpuUsage = this.getAverageCpuUsage();

    if (avgCpuUsage > this.cpuThreshold) {
      if (this.cpuCheckStartTime === 0) {
        this.cpuCheckStartTime = performance.now();
      } else {
        const highCpuDuration = performance.now() - this.cpuCheckStartTime;
        if (highCpuDuration >= this.cpuMonitorDuration && !this.isThrottled) {
          this.throttleDown(avgCpuUsage);
        }
      }
    } else {
      this.cpuCheckStartTime = 0;
      if (this.isThrottled && avgCpuUsage < this.cpuThreshold * 0.5) {
        this.throttleUp(avgCpuUsage);
      }
    }
  }

  private throttleDown(cpuUsage: number): void {
    const previousFps = this.effectiveFps;
    
    if (this.effectiveFps > FPS_MODES.battery) {
      this.effectiveFps = Math.max(
        FPS_MODES.battery,
        Math.floor(this.effectiveFps * 0.7)
      );
      this.frameInterval = 1000 / this.effectiveFps;
      this.isThrottled = true;

      const event: ThrottleEvent = {
        timestamp: performance.now(),
        reason: `CPU usage (${cpuUsage.toFixed(2)}%) exceeded threshold (${this.cpuThreshold}%) for ${this.cpuMonitorDuration / 1000}s`,
        previousFps,
        newFps: this.effectiveFps,
        cpuUsage,
      };

      this.throttleEvents.push(event);
      console.warn('[DetectionLoop] Auto-throttling engaged:', event);
    }
  }

  private throttleUp(cpuUsage: number): void {
    const previousFps = this.effectiveFps;
    
    if (this.effectiveFps < this.targetFps) {
      this.effectiveFps = Math.min(
        this.targetFps,
        Math.ceil(this.effectiveFps * 1.2)
      );
      this.frameInterval = 1000 / this.effectiveFps;

      if (this.effectiveFps >= this.targetFps) {
        this.isThrottled = false;
      }

      const event: ThrottleEvent = {
        timestamp: performance.now(),
        reason: `CPU usage (${cpuUsage.toFixed(2)}%) dropped below recovery threshold (${(this.cpuThreshold * 0.5).toFixed(2)}%)`,
        previousFps,
        newFps: this.effectiveFps,
        cpuUsage,
      };

      this.throttleEvents.push(event);
      console.log('[DetectionLoop] Auto-throttling relaxed:', event);
    }
  }

  public getMetrics(now: number): LoopMetrics {
    const timeSinceLastMetrics = now - this.lastMetricsTime;
    const actualFps = timeSinceLastMetrics > 0 
      ? (this.framesProcessed / timeSinceLastMetrics) * 1000
      : 0;

    return {
      currentFps: actualFps,
      targetFps: this.targetFps,
      avgProcessingTime: this.getAverageProcessingTime(),
      cpuUsagePercent: this.getAverageCpuUsage(),
      framesProcessed: this.framesProcessed,
      framesSkipped: this.framesSkipped,
      isThrottled: this.isThrottled,
      throttleReason: this.isThrottled ? this.getLastThrottleReason() : undefined,
    };
  }

  public resetMetrics(): void {
    this.framesProcessed = 0;
    this.framesSkipped = 0;
    this.lastMetricsTime = performance.now();
  }

  public getThrottleEvents(): ThrottleEvent[] {
    return [...this.throttleEvents];
  }

  public clearThrottleEvents(): void {
    this.throttleEvents = [];
  }

  private getAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0;
    }
    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.processingTimes.length;
  }

  private getAverageCpuUsage(): number {
    if (this.cpuSamples.length === 0) {
      return 0;
    }
    const sum = this.cpuSamples.reduce((acc, usage) => acc + usage, 0);
    return sum / this.cpuSamples.length;
  }

  private getLastThrottleReason(): string | undefined {
    if (this.throttleEvents.length === 0) {
      return undefined;
    }
    return this.throttleEvents[this.throttleEvents.length - 1].reason;
  }

  public reset(): void {
    this.frameCounter = 0;
    this.lastFrameTime = 0;
    this.processingTimes = [];
    this.cpuSamples = [];
    this.cpuCheckStartTime = 0;
    this.isThrottled = false;
    this.framesProcessed = 0;
    this.framesSkipped = 0;
    this.lastMetricsTime = 0;
  }
}

export function createDetectionLoop(config: LoopConfig): DetectionLoop {
  return new DetectionLoop(config);
}
