import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types/settings';
import DetectionSettings from './DetectionSettings';

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 240;

function SettingsForm(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings>({
    blink: { enabled: true, interval: 20 },
    posture: { enabled: true, interval: 30 },
    app: { startOnLogin: false },
    detection: { enabled: false },
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [testingBlink, setTestingBlink] = useState<boolean>(false);
  const [testingPosture, setTestingPosture] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const loadedSettings = await window.electronAPI.settings.get();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (partialSettings: Partial<AppSettings>): Promise<void> => {
    try {
      const updatedSettings = await window.electronAPI.settings.set(partialSettings);
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleBlinkEnabledChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    updateSetting({ blink: { ...settings.blink, enabled: e.target.checked } });
  };

  const handleBlinkIntervalChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= MIN_INTERVAL && value <= MAX_INTERVAL) {
      updateSetting({ blink: { ...settings.blink, interval: value } });
    }
  };

  const handlePostureEnabledChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    updateSetting({ posture: { ...settings.posture, enabled: e.target.checked } });
  };

  const handlePostureIntervalChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= MIN_INTERVAL && value <= MAX_INTERVAL) {
      updateSetting({ posture: { ...settings.posture, interval: value } });
    }
  };

  const handleStartOnLoginChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const enabled = e.target.checked;
    updateSetting({ app: { ...settings.app, startOnLogin: enabled } });
    window.electronAPI.autostart.toggle(enabled);
  };

  const handleTestBlinkNotification = async (): Promise<void> => {
    setTestingBlink(true);
    try {
      await window.electronAPI.reminder.testBlink();
      console.log('Blink notification test triggered');
    } catch (error) {
      console.error('Failed to test blink notification:', error);
    } finally {
      setTestingBlink(false);
    }
  };

  const handleTestPostureNotification = async (): Promise<void> => {
    setTestingPosture(true);
    try {
      await window.electronAPI.reminder.testPosture();
      console.log('Posture notification test triggered');
    } catch (error) {
      console.error('Failed to test posture notification:', error);
    } finally {
      setTestingPosture(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '30px',
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Wellness Reminder Settings</h1>

      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#555' }}>
          Blink Reminder
        </h2>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.blink.enabled}
              onChange={handleBlinkEnabledChange}
              style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span>Enable blink reminder</span>
          </label>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Interval (minutes):
          </label>
          <input
            type="number"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            value={settings.blink.interval}
            onChange={handleBlinkIntervalChange}
            disabled={!settings.blink.enabled}
            style={{
              padding: '8px',
              width: '100px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              opacity: settings.blink.enabled ? 1 : 0.6,
            }}
          />
          <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
            (min: {MIN_INTERVAL}, max: {MAX_INTERVAL})
          </span>
        </div>
        <button
          onClick={handleTestBlinkNotification}
          disabled={testingBlink}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: testingBlink ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: testingBlink ? 0.6 : 1,
          }}
        >
          {testingBlink ? 'Testing...' : 'Test Blink Notification'}
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#555' }}>
          Posture Reminder
        </h2>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.posture.enabled}
              onChange={handlePostureEnabledChange}
              style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span>Enable posture reminder</span>
          </label>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Interval (minutes):
          </label>
          <input
            type="number"
            min={MIN_INTERVAL}
            max={MAX_INTERVAL}
            value={settings.posture.interval}
            onChange={handlePostureIntervalChange}
            disabled={!settings.posture.enabled}
            style={{
              padding: '8px',
              width: '100px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              opacity: settings.posture.enabled ? 1 : 0.6,
            }}
          />
          <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
            (min: {MIN_INTERVAL}, max: {MAX_INTERVAL})
          </span>
        </div>
        <button
          onClick={handleTestPostureNotification}
          disabled={testingPosture}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: testingPosture ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: testingPosture ? 0.6 : 1,
          }}
        >
          {testingPosture ? 'Testing...' : 'Test Posture Notification'}
        </button>
      </div>

      <DetectionSettings
        onSettingsChange={(detectionSettings) => {
          setSettings({ ...settings, detection: detectionSettings });
        }}
      />

      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#555' }}>
          Application Settings
        </h2>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.app.startOnLogin}
              onChange={handleStartOnLoginChange}
              style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span>Start on login</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default SettingsForm;
