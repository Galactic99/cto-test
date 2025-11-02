declare global {
  interface Window {
    sensorAPI: {
      onStartCamera: (callback: () => void) => void;
      onStopCamera: (callback: () => void) => void;
      notifyCameraError: (error: string) => void;
      notifyCameraStarted: () => void;
      notifyCameraStopped: () => void;
    };
  }
}

let mediaStream: MediaStream | null = null;
let videoElement: HTMLVideoElement | null = null;

async function startCamera(): Promise<void> {
  try {
    console.log('[Sensor] Starting camera...');
    videoElement = document.getElementById('video') as HTMLVideoElement;

    if (!videoElement) {
      throw new Error('Video element not found');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    videoElement.srcObject = mediaStream;
    console.log('[Sensor] Camera started successfully');
    window.sensorAPI.notifyCameraStarted();
  } catch (error) {
    console.error('[Sensor] Error starting camera:', error);
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'name' in error) {
      const domError = error as DOMException;
      errorMessage = domError.name;

      if (domError.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied by user';
      } else if (domError.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device';
      } else if (domError.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application';
      }
    }

    window.sensorAPI.notifyCameraError(errorMessage);
  }
}

function stopCamera(): void {
  console.log('[Sensor] Stopping camera...');

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => {
      track.stop();
      console.log('[Sensor] Stopped track:', track.kind);
    });
    mediaStream = null;
  }

  if (videoElement) {
    videoElement.srcObject = null;
  }

  console.log('[Sensor] Camera stopped successfully');
  window.sensorAPI.notifyCameraStopped();
}

window.sensorAPI.onStartCamera(() => {
  console.log('[Sensor] Received start camera command');
  startCamera();
});

window.sensorAPI.onStopCamera(() => {
  console.log('[Sensor] Received stop camera command');
  stopCamera();
});

window.addEventListener('beforeunload', () => {
  console.log('[Sensor] Window unloading, stopping camera');
  stopCamera();
});

console.log('[Sensor] Sensor window initialized');
