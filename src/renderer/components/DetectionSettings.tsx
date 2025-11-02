import React, { useState, useEffect } from 'react';
import { DetectionSettings as DetectionSettingsType, FpsMode } from '../../types/settings';
import { DetectionStatus } from '../../types/detection';

interface DetectionSettingsProps {
  onSettingsChange?: (settings: DetectionSettingsType) => void;
}

const FPS_OPTIONS = [
  { value: 'low' as FpsMode, label: 'Battery saver (6 FPS)', fps: 6 },
  { value: 'medium' as FpsMode, label: 'Balanced (10 FPS)', fps: 10 },
  { value: 'high' as FpsMode, label: 'Accurate (15 FPS)', fps: 15 },
];

function DetectionSettings({ onSettingsChange }: DetectionSettingsProps): React.ReactElement {
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettingsType>({
    enabled: false,
    features: {
      blink: true,
      posture: true,
    },
    fpsMode: 'medium',
  });
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDetectionStatus();
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const settings = await window.electronAPI.settings.get();
      const detection = settings.detection || {
        enabled: false,
        features: { blink: true, posture: true },
        fpsMode: 'medium' as FpsMode,
      };
      
      // Ensure features and fpsMode are set
      if (!detection.features) {
        detection.features = { blink: true, posture: true };
      }
      if (!detection.fpsMode) {
        detection.fpsMode = 'medium';
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
    const { enabled, features } = settings;
    const hasAnyFeatureEnabled = features?.blink || features?.posture;

    try {
      if (enabled && hasAnyFeatureEnabled) {
        // Start detection if enabled and at least one feature is on
        if (!detectionStatus?.isRunning) {
          console.log('[DetectionSettings] Starting detection...');
          await window.electronAPI.detection.start();
        }
      } else {
        // Stop detection if disabled or no features enabled
        if (detectionStatus?.isRunning) {
          console.log('[DetectionSettings] Stopping detection...');
          await window.electronAPI.detection.stop();
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
        ...detectionSettings.features,
        blink: enabled,
      },
    });
  };

  const handlePostureToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const enabled = e.target.checked;
    updateDetectionSettings({
      features: {
        ...detectionSettings.features,
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
    updateDetectionSettings({ enabled });
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

      {/* Detection status indicator */}
      {detectionSettings.enabled && (
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
          value={detectionSettings.fpsMode || 'medium'}
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
  );
}

export default DetectionSettings;
