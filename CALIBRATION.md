# Posture Calibration Feature

## Overview

The posture calibration feature allows users to personalize posture detection by establishing a baseline for their ideal upright position. This improves detection accuracy by accounting for individual differences in natural posture and camera setup.

## How It Works

### User Flow

1. **Enable Detection**: User must first enable camera-based detection and grant camera permissions
2. **Start Calibration**: Click "Calibrate Posture" button in the Settings UI
3. **Sit Upright**: User is prompted to sit in their ideal upright posture for 5 seconds
4. **Baseline Captured**: The system samples head pitch angles during this period
5. **Baseline Applied**: The average baseline is saved and immediately applied to posture detection

### Technical Implementation

#### Components

- **`Calibration.tsx`**: UI component with calibration button and countdown timer
- **`sensor.ts`**: Captures head pitch samples during calibration period
- **`posture.ts`**: PostureDetector class applies baseline to scoring calculations
- **IPC Handlers**: Coordinates calibration flow between processes

#### Data Flow

```
User clicks "Calibrate" 
  → Frontend: window.electronAPI.detection.calibratePosture()
  → Main Process: detection:calibrate:posture handler
  → Sensor Window: sensor:calibrate-posture message
  → Sensor: Collects samples for 5 seconds
  → Sensor: Calculates average baseline
  → Main Process: sensor:calibration-result
  → Settings Store: Saves postureBaselinePitch & timestamp
  → Sensor Window: detection:configure with new baseline
  → PostureDetector: Applies baseline to scoring
```

#### Settings Persistence

Two new fields in `DetectionSettings`:
- `postureBaselinePitch?: number` - The calibrated baseline head pitch angle
- `postureCalibrationTimestamp?: number` - When calibration was performed

These persist across app restarts via electron-store.

#### Baseline Application

The `PostureDetector` class adjusts posture scoring using the baseline:

```typescript
// Without baseline: absolute angles are used
// With baseline: angles are relative to user's calibrated position

const adjustedHeadPitch = hasBaseline 
  ? currentPitch - baselinePitch 
  : currentPitch;
  
// Poor posture threshold becomes relative to baseline
const threshold = baseline + allowedOffset; // e.g., 15° + 15° = 30°
```

## UI Features

- **Status Display**: Shows last calibration timestamp
- **Recalibration**: Users can recalibrate at any time
- **Countdown Timer**: Visual 5-second countdown during calibration
- **Requirement Checks**: Disabled when detection is not running
- **Error Handling**: Timeout protection and clear error messages

## Testing

### Unit Tests (`tests/calibration.test.ts`)

- Baseline application logic
- Average calculation from samples
- Threshold derivation from baseline + offset
- Edge cases (single sample, many samples, negative values)

### Manual Testing

1. Enable detection with camera permission
2. Click "Calibrate Posture"
3. Sit upright for 5 seconds
4. Verify baseline is saved (check timestamp display)
5. Test posture detection with good/poor posture
6. Restart app and verify baseline persists
7. Recalibrate and verify new baseline is applied

## Benefits

1. **Personalized Detection**: Accounts for individual posture variations
2. **Camera Position**: Adapts to different camera angles/heights
3. **Improved Accuracy**: Reduces false positives/negatives
4. **User Control**: Easy to recalibrate if setup changes

## Implementation Notes

- Calibration requires active detection (camera must be running)
- 5-second duration collects ~50-75 samples (depending on FPS mode)
- Average baseline smooths out minor variations
- Baseline is immediately applied without requiring restart
- Calibration timeout is 10 seconds to handle slow responses
