import React, { useState, useEffect, useRef } from 'react';
import { DetectionMetrics } from '../../types/detection';

const POLL_INTERVAL_MS = 2000; // 2 seconds
const BLINK_RATE_HEALTHY_MIN = 12;
const BLINK_RATE_HEALTHY_MAX = 25;
const POSTURE_SCORE_GOOD = 70;
const POSTURE_SCORE_WARNING = 50;

interface DetectionPreviewProps {
  isDetectionRunning: boolean;
}

function DetectionPreview({ isDetectionRunning }: DetectionPreviewProps): React.ReactElement {
  const [metrics, setMetrics] = useState<DetectionMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasRunningRef = useRef<boolean>(isDetectionRunning);

  // Handle window visibility changes
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Poll for metrics
  useEffect(() => {
    const fetchMetrics = async (): Promise<void> => {
      if (!isDetectionRunning || !isVisible) {
        return;
      }

      try {
        const currentMetrics = await window.electronAPI.detection.getMetrics();
        setMetrics(currentMetrics);
        setLastUpdated(Date.now());
      } catch (error) {
        console.error('[DetectionPreview] Failed to fetch metrics:', error);
      }
    };

    // Initial fetch
    if (isDetectionRunning && isVisible) {
      fetchMetrics();
      // Set up polling
      pollingIntervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    }

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      // Reset metrics in cleanup when detection stops
      if (!isDetectionRunning && wasRunningRef.current) {
        setMetrics(null);
        setLastUpdated(null);
        wasRunningRef.current = false;
      }
    };
  }, [isDetectionRunning, isVisible]);

  const getBlinkRateStatus = (blinkRate: number): 'healthy' | 'warning' => {
    if (blinkRate >= BLINK_RATE_HEALTHY_MIN && blinkRate <= BLINK_RATE_HEALTHY_MAX) {
      return 'healthy';
    }
    return 'warning';
  };

  const getPostureScoreStatus = (score: number): 'good' | 'warning' | 'poor' => {
    if (score >= POSTURE_SCORE_GOOD) {
      return 'good';
    }
    if (score >= POSTURE_SCORE_WARNING) {
      return 'warning';
    }
    return 'poor';
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'good':
        return '#28a745';
      case 'warning':
        return '#ffc107';
      case 'poor':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'good':
        return '✓';
      case 'warning':
        return '⚠';
      case 'poor':
        return '✗';
      default:
        return '•';
    }
  };

  // Show placeholder when detection is not running
  if (!isDetectionRunning) {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#555' }}>
          Live Detection Preview
        </h3>
        <div
          style={{
            padding: '15px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px',
          }}
        >
          Detection is not running. Enable detection to see live metrics.
        </div>
      </div>
    );
  }

  // Show loading state while waiting for first metrics
  if (!metrics || !lastUpdated) {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#555' }}>
          Live Detection Preview
        </h3>
        <div
          style={{
            padding: '15px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px',
          }}
        >
          Loading metrics...
        </div>
      </div>
    );
  }

  const blinkRate = metrics.blink?.blinkRate ?? null;
  const postureScore = metrics.posture?.postureScore ?? null;

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ fontSize: '16px', margin: 0, color: '#555' }}>
          Live Detection Preview
        </h3>
        <div style={{ fontSize: '12px', color: '#6c757d' }}>
          Last updated: {formatTimestamp(lastUpdated)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px' }}>
        {/* Blink Rate Card */}
        <div
          style={{
            flex: 1,
            padding: '15px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
            Blink Rate
          </div>
          {blinkRate !== null ? (
            <>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                {blinkRate.toFixed(1)}
                <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  blinks/min
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  color: getStatusColor(getBlinkRateStatus(blinkRate)),
                }}
              >
                <span style={{ marginRight: '5px' }}>
                  {getStatusIcon(getBlinkRateStatus(blinkRate))}
                </span>
                {getBlinkRateStatus(blinkRate) === 'healthy' ? 'Healthy' : 'Check eye strain'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '14px', color: '#6c757d', paddingTop: '10px' }}>
              No data available
            </div>
          )}
        </div>

        {/* Posture Score Card */}
        <div
          style={{
            flex: 1,
            padding: '15px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
            Posture Score
          </div>
          {postureScore !== null ? (
            <>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                {postureScore.toFixed(0)}
                <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  / 100
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  color: getStatusColor(getPostureScoreStatus(postureScore)),
                }}
              >
                <span style={{ marginRight: '5px' }}>
                  {getStatusIcon(getPostureScoreStatus(postureScore))}
                </span>
                {getPostureScoreStatus(postureScore) === 'good' && 'Good posture'}
                {getPostureScoreStatus(postureScore) === 'warning' && 'Fair posture'}
                {getPostureScoreStatus(postureScore) === 'poor' && 'Poor posture'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '14px', color: '#6c757d', paddingTop: '10px' }}>
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Additional info section */}
      <div
        style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#004085',
        }}
      >
        <div style={{ marginBottom: '4px' }}>
          <strong>Healthy ranges:</strong>
        </div>
        <div>
          • Blink rate: {BLINK_RATE_HEALTHY_MIN}-{BLINK_RATE_HEALTHY_MAX} blinks/min
          {' • '}
          Posture score: ≥ {POSTURE_SCORE_GOOD} for good posture
        </div>
      </div>
    </div>
  );
}

export default DetectionPreview;
