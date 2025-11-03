import React, { useState, useEffect } from 'react';
import { DetectionSettings as DetectionSettingsType, FpsMode } from '../../types/settings';
import { DetectionStatus, DetectionError } from '../../types/detection';
import PrivacyNote from './PrivacyNote';

interface DetectionSettingsProps {
  onSettingsChange?: (settings: DetectionSettingsType) => void;
}

const FPS_OPTIONS = [
  { value: 'battery' as FpsMode, label: 'Battery saver (6 FPS)', fps: 6 },
  { value: 'balanced' as FpsMode, label: 'Balanced (10 FPS)', fps: 10 },
  { value: 'accurate' as FpsMode, label: 'Accurate (15 FPS)', fps: 15 },
];

function DetectionSettings({ onSettingsChange }: DetectionSettingsProps): React.ReactElement {
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettingsType>({
    enabled: false,
    features: {
      blink: true,
      posture: true,
    },
    fpsMode: 'balanced',
    privacyConsentGiven: false,
  });
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showPrivacyNote, setShowPrivacyNote] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionError, setDetectionError] = useState<DetectionError | null>(null);

  useEffect(() => {
    loadSettings();
    loadDetectionStatus();

    window.electronAPI.sensor.onCameraError((error) => {
      console.error('[DetectionSettings] Camera error:', error);
      setCameraError(error);
    });

    window.electronAPI.sensor.onDetectionError((error) => {
      console.error('[DetectionSettings] Detection error:', error);
      setDetectionError(error);
      setCameraError(null);
    });

    window.electronAPI.sensor.onCameraStarted(() => {
      console.log('[DetectionSettings] Camera started');
      setCameraError(null);
      setDetectionError(null);
    });

    window.electronAPI.sensor.onCameraStopped(() => {
      console.log('[DetectionSettings] Camera stopped');
    });
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const settings = await window.electronAPI.settings.get();
      const detection = settings.detection || {
        enabled: false,
        features: { blink: true, posture: true },
        fpsMode: 'balanced' as FpsMode,
        privacyConsentGiven: false,
      };
      
      // Ensure features, fpsMode, and privacyConsentGiven are set
      if (!detection.features) {
        detection.features = { blink: true, posture: true };
      }
      if (!detection.fpsMode) {
        detection.fpsMode = 'balanced';
      }
      if (detection.privacyConsentGiven === undefined) {
        detection.privacyConsentGiven = false;
      }
      
      setDetectionSettings(detection);
    } catch (error) {
      console.error('[DetectionSettings] Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetectionStatus = async (): Promise<void> => {
    try {
      const status = await window.electronAPI.detection.getStatus();
      setDetectionStatus(status);
    } catch (error) {
      console.error('[DetectionSettings] Failed to load detection status:', error);
    }
  };

  const updateDetectionSettings = async (
    updates: Partial<DetectionSettingsType>
  ): Promise<void> => {
    setUpdating(true);
    try {
      const updatedSettings = { ...detectionSettings, ...updates };
      
      // Persist to store
      await window.electronAPI.settings.set({
        detection: updatedSettings,
      });
      
      // Update detection state in main process
      const status = await window.electronAPI.detection.setSettings({
        features: updatedSettings.features,
        fpsMode: updatedSettings.fpsMode,
      });
      
      setDetectionSettings(updatedSettings);
      setDetectionStatus(status);
      
      // Handle detection lifecycle
      await handleDetectionLifecycle(updatedSettings);
      
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
      
      console.log('[DetectionSettings] Settings updated:', updatedSettings);
    } catch (error) {
      console.error('[DetectionSettings] Failed to update settings:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDetectionLifecycle = async (
    settings: DetectionSettingsType
  ): Promise<void> => {
    const { enabled, features, privacyConsentGiven } = settings;
    const hasAnyFeatureEnabled = features?.blink || features?.posture;

    try {
      if (enabled && hasAnyFeatureEnabled && privacyConsentGiven) {
        // Start detection only if enabled, features on, AND consent given
        if (!detectionStatus?.isRunning) {
          console.log('[DetectionSettings] Starting detection...');
          try {
            await window.electronAPI.detection.start();
            setCameraError(null);
          } catch (error) {
            console.error('[DetectionSettings] Failed to start detection:', error);
            setCameraError('Failed to start camera. Please check permissions and try again.');
          }
        }
      } else {
        // Stop detection if disabled, no features enabled, or no consent
        if (detectionStatus?.isRunning) {
          console.log('[DetectionSettings] Stopping detection...');
          await window.electronAPI.detection.stop();
          setCameraError(null);
        }
      }
      
      // Refresh status
      await loadDetectionStatus();
    } catch (error) {
      console.error('[DetectionSettings] Failed to handle detection lifecycle:', error);
    }
  };

  const handleBlinkToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const enabled = e.target.checked;
    updateDetectionSettings({
      features: {
        blink: enabled,
        posture: detectionSettings.features?.posture ?? true,
      },
    });
  };

  const handlePostureToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const enabled = e.target.checked;
    updateDetectionSettings({
      features: {
        blink: detectionSettings.features?.blink ?? true,
        posture: enabled,
      },
    });
  };

  const handleFpsModeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const fpsMode = e.target.value as FpsMode;
    updateDetectionSettings({ fpsMode });
  };

  const handleMasterToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const enabled = e.target.checked;
    
    if (enabled && !detectionSettings.privacyConsentGiven) {
      // Show privacy note if trying to enable without consent
      setShowPrivacyNote(true);
    } else {
      updateDetectionSettings({ enabled });
    }
  };

  const handlePrivacyConsent = async (consented: boolean): Promise<void> => {
    setShowPrivacyNote(false);
    
    if (consented) {
      // User gave consent, enable detection
      await updateDetectionSettings({
        enabled: true,
        privacyConsentGiven: true,
      });
    }
  };

  const handlePrivacyNoteClose = (): void => {
    setShowPrivacyNote(false);
  };

  const handleRevokeConsent = async (): Promise<void> => {
    if (window.confirm('Are you sure you want to revoke camera consent? This will disable all detection features.')) {
      await updateDetectionSettings({
        enabled: false,
        privacyConsentGiven: false,
      });
    }
  };

  const handleRetryCamera = async (): Promise<void> => {
    setCameraError(null);
    setDetectionError(null);
    if (detectionSettings.enabled && detectionSettings.privacyConsentGiven) {
      try {
        await window.electronAPI.detection.retry();
      } catch (error) {
        console.error('[DetectionSettings] Failed to retry camera:', error);
        setCameraError('Failed to start camera. Please check permissions and try again.');
      }
    }
  };

  const getErrorMessage = (): string => {
    if (detectionError) {
      return detectionError.message;
    }
    if (cameraError) {
      return cameraError;
    }
    return '';
  };

  const getErrorTitle = (): string => {
    if (!detectionError) {
      return 'Camera Error';
    }

    switch (detectionError.type) {
      case 'camera_permission_denied':
        return 'Camera Permission Denied';
      case 'camera_not_found':
        return 'Camera Not Found';
      case 'camera_in_use':
        return 'Camera In Use';
      case 'model_load_failed':
        return 'Model Load Failed';
      case 'runtime_error':
        return 'Detection Error';
      default:
        return 'Detection Error';
    }
  };

  const shouldShowRetry = (): boolean => {
    if (cameraError) return true;
    if (detectionError && detectionError.retryable) return true;
    return false;
  };

  if (loading) {
    return (
      <div style={{ padding: '10px' }}>
        <p style={{ color: '#666', fontSize: '14px' }}>Loading detection settings...</p>
      </div>
    );
  }

  const isDetectionRunning = detectionStatus?.isRunning ?? false;
  const hasAnyFeatureEnabled =
    detectionSettings.features?.blink || detectionSettings.features?.posture;

  return (
    <>
      {showPrivacyNote && (
        <PrivacyNote onConsent={handlePrivacyConsent} onClose={handlePrivacyNoteClose} />
      )}
      
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#555' }}>
          Detection Settings
        </h2>

        {/* Master detection toggle */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={detectionSettings.enabled}
              onChange={handleMasterToggle}
              disabled={updating}
              style={{
                marginRight: '10px',
                width: '18px',
                height: '18px',
                cursor: updating ? 'not-allowed' : 'pointer',
              }}
            />
            <span style={{ fontWeight: 'bold' }}>Enable camera-based detection</span>
          </label>
          <p style={{ marginLeft: '28px', fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Uses your camera to detect blinks and posture for smarter reminders
          </p>
        </div>

        {/* Privacy consent status */}
        {detectionSettings.privacyConsentGiven && (
          <div
            style={{
              marginBottom: '20px',
              padding: '10px',
              backgroundColor: '#e7f3ff',
              border: '1px solid #b3d9ff',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#004085' }}>
                ✓ Camera consent granted
              </span>
              <button
                onClick={handleRevokeConsent}
                style={{
                  padding: '5px 10px',
                  backgroundColor: 'transparent',
                  color: '#004085',
                  border: '1px solid #004085',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Revoke Consent
              </button>
            </div>
          </div>
        )}

        {/* Detection/Camera error message */}
        {(cameraError || detectionError) && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
              fontSize: '14px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <strong>⚠ {getErrorTitle()}:</strong> {getErrorMessage()}
            </div>
            {detectionError?.retryCount !== undefined && detectionError.retryCount > 0 && (
              <div style={{ marginBottom: '10px', fontSize: '12px', color: '#856404' }}>
                Retry attempt {detectionError.retryCount} of 5
              </div>
            )}
            {shouldShowRetry() && (
              <button
                onClick={handleRetryCamera}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#721c24',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {detectionError?.retryCount && detectionError.retryCount > 0
                  ? 'Retry Now'
                  : 'Retry Camera Access'}
              </button>
            )}
            {detectionError && !detectionError.retryable && (
              <div style={{ marginTop: '10px', fontSize: '12px', fontStyle: 'italic' }}>
                This error cannot be automatically resolved. Please check your camera settings and permissions.
              </div>
            )}
          </div>
        )}

        {/* Consent required message */}
        {detectionSettings.enabled && !detectionSettings.privacyConsentGiven && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeeba',
              borderRadius: '4px',
              color: '#856404',
              fontSize: '14px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <strong>⚠ Privacy consent required:</strong> You must grant camera consent to use detection features.
            </div>
            <button
              onClick={() => setShowPrivacyNote(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#856404',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Review Privacy & Grant Consent
            </button>
          </div>
        )}

      {/* Detection status indicator */}
      {detectionSettings.enabled && detectionSettings.privacyConsentGiven && (
        <div
          style={{
            padding: '10px',
            backgroundColor: isDetectionRunning ? '#d4edda' : '#f8d7da',
            border: `1px solid ${isDetectionRunning ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            color: isDetectionRunning ? '#155724' : '#721c24',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          {isDetectionRunning
            ? '✓ Detection is running'
            : hasAnyFeatureEnabled
            ? '⚠ Detection is not running (check permissions)'
            : '⚠ No detection features enabled'}
        </div>
      )}

      {/* Feature toggles */}
      <div
        style={{
          marginLeft: '28px',
          marginBottom: '20px',
          opacity: detectionSettings.enabled ? 1 : 0.6,
          pointerEvents: detectionSettings.enabled ? 'auto' : 'none',
        }}
      >
        <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#555' }}>
          Detection Features
        </h3>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={detectionSettings.features?.blink ?? true}
              onChange={handleBlinkToggle}
              disabled={!detectionSettings.enabled || updating}
              style={{
                marginRight: '10px',
                width: '16px',
                height: '16px',
                cursor: !detectionSettings.enabled || updating ? 'not-allowed' : 'pointer',
              }}
            />
            <span>Blink detection</span>
          </label>
          <p
            style={{
              marginLeft: '26px',
              fontSize: '11px',
              color: '#666',
              marginTop: '2px',
            }}
          >
            Tracks blink frequency to detect eye strain
          </p>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={detectionSettings.features?.posture ?? true}
              onChange={handlePostureToggle}
              disabled={!detectionSettings.enabled || updating}
              style={{
                marginRight: '10px',
                width: '16px',
                height: '16px',
                cursor: !detectionSettings.enabled || updating ? 'not-allowed' : 'pointer',
              }}
            />
            <span>Posture detection</span>
          </label>
          <p
            style={{
              marginLeft: '26px',
              fontSize: '11px',
              color: '#666',
              marginTop: '2px',
            }}
          >
            Monitors head position to detect poor posture
          </p>
        </div>
      </div>

      {/* FPS mode dropdown */}
      <div
        style={{
          marginLeft: '28px',
          opacity: detectionSettings.enabled ? 1 : 0.6,
          pointerEvents: detectionSettings.enabled ? 'auto' : 'none',
        }}
      >
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
          Processing mode:
        </label>
        <select
          value={detectionSettings.fpsMode || 'balanced'}
          onChange={handleFpsModeChange}
          disabled={!detectionSettings.enabled || updating}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: !detectionSettings.enabled || updating ? 'not-allowed' : 'pointer',
            minWidth: '200px',
          }}
        >
          {FPS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
          Higher frame rates provide more accurate detection but use more battery
        </p>
      </div>

      {updating && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          Updating settings...
        </div>
      )}
      </div>
    </>
  );
}

export default DetectionSettings;
