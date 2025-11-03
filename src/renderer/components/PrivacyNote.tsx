import React, { useState } from 'react';

interface PrivacyNoteProps {
  onConsent: (consented: boolean) => void;
  onClose: () => void;
}

function PrivacyNote({ onConsent, onClose }: PrivacyNoteProps): React.ReactElement {
  const [consentChecked, setConsentChecked] = useState(false);

  const handleSubmit = (): void => {
    onConsent(consentChecked);
  };

  const handleCancel = (): void => {
    onClose();
  };

  const handleOpenCameraHelp = async (): Promise<void> => {
    try {
      const docPath = await window.electronAPI.docs.getCameraPermissionsPath();
      await window.electronAPI.shell.openExternal(`file://${docPath}`);
    } catch (error) {
      console.error('[PrivacyNote] Failed to open camera permissions doc:', error);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          maxWidth: '550px',
          width: '90%',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333', fontSize: '24px' }}>
          Privacy Notice: Camera Access
        </h2>
        
        <div style={{ marginBottom: '20px', lineHeight: '1.6', color: '#555' }}>
          <p style={{ marginBottom: '15px' }}>
            This application uses your device camera to provide smart wellness reminders based on:
          </p>
          <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>Blink detection:</strong> Monitors your blink frequency to detect eye strain
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Posture detection:</strong> Tracks your head position to identify poor posture
            </li>
          </ul>
          <p style={{ marginBottom: '15px' }}>
            <strong>Your privacy is important to us:</strong>
          </p>
          <ul style={{ marginBottom: '15px', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>
              All camera processing happens locally on your device
            </li>
            <li style={{ marginBottom: '8px' }}>
              No images or video are stored, transmitted, or shared
            </li>
            <li style={{ marginBottom: '8px' }}>
              You can disable camera features at any time in settings
            </li>
          </ul>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
            For more information, please see our{' '}
            <a
              href="https://github.com/Galactic99/cto-test/blob/main/PRIVACY.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#007bff', textDecoration: 'none' }}
            >
              privacy documentation
            </a>
            .
          </p>
          <button
            onClick={handleOpenCameraHelp}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            📷 Camera Permission Help
          </button>
        </div>

        <div
          style={{
            marginBottom: '25px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            border: '1px solid #dee2e6',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{
                marginRight: '12px',
                marginTop: '3px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '14px', color: '#333' }}>
              I understand and consent to camera access for detection features. I acknowledge that
              camera processing is performed locally and I can revoke this consent at any time.
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!consentChecked}
            style={{
              padding: '10px 20px',
              backgroundColor: consentChecked ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: consentChecked ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Enable Detection
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrivacyNote;
