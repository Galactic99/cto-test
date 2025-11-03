import React, { useState, useEffect } from 'react';
import { DetectionSettings } from '../../types/settings';

interface CalibrationProps {
  detectionSettings: DetectionSettings;
  isDetectionRunning: boolean;
  onCalibrationComplete?: () => void;
}

function Calibration({
  detectionSettings,
  isDetectionRunning,
  onCalibrationComplete,
}: CalibrationProps): React.ReactElement | null {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const canCalibrate =
    detectionSettings.enabled &&
    detectionSettings.privacyConsentGiven &&
    detectionSettings.features?.posture &&
    isDetectionRunning;

  const hasCalibration = detectionSettings.postureBaselinePitch !== undefined;
  const lastCalibrated = detectionSettings.postureCalibrationTimestamp
    ? new Date(detectionSettings.postureCalibrationTimestamp).toLocaleString()
    : null;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCalibrating && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (isCalibrating && countdown === 0) {
      completeCalibration();
    }
    return () => clearTimeout(timer);
  }, [isCalibrating, countdown]);

  const startCalibration = async (): Promise<void> => {
    if (!canCalibrate) {
      setError('Cannot calibrate: detection must be running with camera permission granted');
      return;
    }

    setIsCalibrating(true);
    setCountdown(5);
    setError(null);
  };

  const completeCalibration = async (): Promise<void> => {
    try {
      await window.electronAPI.detection.calibratePosture();
      setIsCalibrating(false);
      setCountdown(5);
      if (onCalibrationComplete) {
        onCalibrationComplete();
      }
    } catch (error) {
      console.error('[Calibration] Failed to calibrate:', error);
      setError('Calibration failed. Please try again.');
      setIsCalibrating(false);
      setCountdown(5);
    }
  };

  const cancelCalibration = (): void => {
    setIsCalibrating(false);
    setCountdown(5);
    setError(null);
  };

  if (!detectionSettings.features?.posture) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
      }}
    >
      <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#555' }}>
        Posture Calibration
      </h2>

      <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
        Calibrate your posture baseline to personalize posture detection. Sit in your ideal upright
        position and the app will use this as your reference point.
      </p>

      {error && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
            marginBottom: '15px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {hasCalibration && lastCalibrated && !isCalibrating && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            color: '#155724',
            marginBottom: '15px',
            fontSize: '13px',
          }}
        >
          ✓ Last calibrated: {lastCalibrated}
        </div>
      )}

      {!canCalibrate && !isCalibrating && (
        <div
          style={{
            padding: '10px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeeba',
            borderRadius: '4px',
            color: '#856404',
            marginBottom: '15px',
            fontSize: '13px',
          }}
        >
          ⚠ Calibration requires detection to be enabled and running with camera permission granted
        </div>
      )}

      {isCalibrating && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#d1ecf1',
            border: '2px solid #bee5eb',
            borderRadius: '8px',
            marginBottom: '15px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#0c5460', marginBottom: '10px' }}>
            {countdown}
          </div>
          <p style={{ fontSize: '16px', color: '#0c5460', marginBottom: '10px' }}>
            Sit upright in your ideal posture
          </p>
          <p style={{ fontSize: '13px', color: '#0c5460' }}>
            Keep this position until calibration completes
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        {!isCalibrating ? (
          <button
            onClick={startCalibration}
            disabled={!canCalibrate}
            style={{
              padding: '10px 20px',
              backgroundColor: canCalibrate ? '#17a2b8' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canCalibrate ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: canCalibrate ? 1 : 0.6,
            }}
          >
            {hasCalibration ? 'Recalibrate Posture' : 'Calibrate Posture'}
          </button>
        ) : (
          <button
            onClick={cancelCalibration}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default Calibration;
