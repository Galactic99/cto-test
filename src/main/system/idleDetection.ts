import { powerMonitor } from 'electron';
import { pauseManager } from '../pauseManager';
import { getSettings } from '../store/settings';
import { isDetectionRunning, stopDetection, startDetection } from '../detectionState';

interface IdleState {
  isIdle: boolean;
  detectionWasRunning: boolean;
}

class IdleDetectionManager {
  private pollInterval: NodeJS.Timeout | null = null;
  private state: IdleState = {
    isIdle: false,
    detectionWasRunning: false,
  };
  private readonly POLL_INTERVAL_MS = 30000;
  private isInitialized: boolean = false;

  public initialize(): void {
    if (this.isInitialized) {
      console.log('[IdleDetection] Already initialized');
      return;
    }

    const settings = getSettings();
    if (!settings.detection.idleDetection?.enabled) {
      console.log('[IdleDetection] Idle detection is disabled in settings');
      return;
    }

    console.log('[IdleDetection] Initializing idle detection');
    this.isInitialized = true;
    this.startPolling();
  }

  public shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    console.log('[IdleDetection] Shutting down idle detection');
    this.stopPolling();
    this.isInitialized = false;
    this.state = {
      isIdle: false,
      detectionWasRunning: false,
    };
  }

  public updateSettings(): void {
    const settings = getSettings();
    const enabled = settings.detection.idleDetection?.enabled ?? true;

    if (enabled && !this.isInitialized) {
      this.initialize();
    } else if (!enabled && this.isInitialized) {
      this.shutdown();
    }
  }

  private startPolling(): void {
    if (this.pollInterval) {
      return;
    }

    this.pollInterval = setInterval(() => {
      this.checkIdleState();
    }, this.POLL_INTERVAL_MS);

    this.checkIdleState();
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private checkIdleState(): void {
    try {
      const settings = getSettings();
      const thresholdMinutes = settings.detection.idleDetection?.thresholdMinutes ?? 5;
      const thresholdSeconds = thresholdMinutes * 60;

      const idleTime = powerMonitor.getSystemIdleTime();
      const isCurrentlyIdle = idleTime >= thresholdSeconds;

      if (isCurrentlyIdle && !this.state.isIdle) {
        this.handleBecameIdle();
      } else if (!isCurrentlyIdle && this.state.isIdle) {
        this.handleBecameActive();
      }
    } catch (error) {
      console.error('[IdleDetection] Error checking idle state:', error);
    }
  }

  private handleBecameIdle(): void {
    console.log('[IdleDetection] System became idle');
    this.state.isIdle = true;

    const wasDetectionRunning = isDetectionRunning();
    this.state.detectionWasRunning = wasDetectionRunning;

    if (wasDetectionRunning) {
      console.log('[IdleDetection] Stopping detection due to idle state');
      stopDetection().catch((error) => {
        console.error('[IdleDetection] Error stopping detection:', error);
      });
    }

    const pauseState = pauseManager.getState();
    if (!pauseState.isPaused || pauseState.source === 'idle') {
      const settings = getSettings();
      const thresholdMinutes = settings.detection.idleDetection?.thresholdMinutes ?? 5;
      pauseManager.pause(thresholdMinutes * 4, 'idle');
    }
  }

  private handleBecameActive(): void {
    console.log('[IdleDetection] System became active');
    this.state.isIdle = false;

    const pauseState = pauseManager.getState();
    if (pauseState.isPaused && pauseState.source === 'idle') {
      console.log('[IdleDetection] Resuming from idle-triggered pause');
      pauseManager.resume();
    }

    if (this.state.detectionWasRunning) {
      console.log('[IdleDetection] Restarting detection after idle state');
      startDetection().catch((error) => {
        console.error('[IdleDetection] Error restarting detection:', error);
      });
      this.state.detectionWasRunning = false;
    }
  }

  public getState(): IdleState {
    return { ...this.state };
  }

  public isIdle(): boolean {
    return this.state.isIdle;
  }
}

export const idleDetectionManager = new IdleDetectionManager();

export function initializeIdleDetection(): void {
  idleDetectionManager.initialize();
}

export function shutdownIdleDetection(): void {
  idleDetectionManager.shutdown();
}

export function updateIdleDetectionSettings(): void {
  idleDetectionManager.updateSettings();
}

export function getIdleState(): IdleState {
  return idleDetectionManager.getState();
}

export function isSystemIdle(): boolean {
  return idleDetectionManager.isIdle();
}
