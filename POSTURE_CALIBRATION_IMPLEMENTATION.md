# Posture Calibration Implementation Summary

## Overview
Implemented user-facing calibration flow to personalize posture thresholds based on baseline posture measurements.

## Changes Made

### 1. Type Definitions (`src/types/settings.ts`)
- Added `postureBaselinePitch?: number` to store calibrated baseline head pitch angle
- Added `postureCalibrationTimestamp?: number` to track when calibration was performed
- Updated `DEFAULT_SETTINGS` to include these fields

### 2. Calibration UI Component (`src/renderer/components/Calibration.tsx`)
New component with the following features:
- **Calibrate Button**: Triggers 5-second calibration sequence
- **Countdown Timer**: Visual feedback during calibration (5...4...3...2...1)
- **Status Display**: Shows last calibrated timestamp
- **Requirement Checks**: Only enabled when detection is active and camera permission granted
- **Error Handling**: Displays error messages with retry capability
- **Recalibration**: Users can recalibrate at any time

### 3. Settings Form Integration (`src/renderer/components/SettingsForm.tsx`)
- Imported and rendered `Calibration` component
- Added `isDetectionRunning` state to track detection status
- Added `checkDetectionStatus()` function to query detection state
- Pass detection settings and running status to Calibration component
- Refresh settings after calibration completes

### 4. Sensor Window Updates (`src/renderer/sensor/sensor.ts`)
- Added calibration state variables:
  - `isCalibrating`: Boolean flag
  - `calibrationSamples`: Array to store head pitch samples
  - `calibrationStartTime`: Timestamp when calibration started
- Modified detection loop to collect samples during calibration
- Calculate average baseline after 5 seconds
- Send calibration result back to main process
- Updated `DetectionConfig` interface to include `postureBaselinePitch`
- Apply baseline to PostureDetector when config is received

### 5. Sensor Preload Bridge (`src/preload/sensor.ts`)
- Added `onCalibratePosture()` to receive calibration start events
- Added `sendCalibrationResult()` to send baseline back to main process
- Updated `SensorAPI` interface
- Updated `onDetectionConfigure` to pass baseline with configuration

### 6. IPC Handler (`src/main/ipc.ts`)
Implemented `detection:calibrate:posture` handler:
- Validates detection is running before allowing calibration
- Sends calibration request to sensor window
- Waits for calibration result with 10-second timeout
- Saves baseline and timestamp to settings store
- Reconfigures sensor with new baseline
- Properly cleans up event listeners

### 7. Detection State Management (`src/main/detectionState.ts`)
- Import settings to access baseline
- Pass `postureBaselinePitch` to sensor when starting detection
- Pass baseline when updating detection configuration
- Ensures baseline is always propagated to sensor

### 8. Posture Detector (`src/renderer/sensor/metrics/posture.ts`)
Already had baseline support implemented:
- `setBaseline()` method to set calibrated values
- `clearBaseline()` to remove calibration
- Baseline adjustment in `calculatePostureScore()`
- Adjusts angles relative to baseline for personalized scoring

### 9. Unit Tests (`tests/calibration.test.ts`)
Created comprehensive test suite with 11 tests covering:
- **Baseline Application**: Verify baseline affects posture scoring
- **Baseline Calculation**: Test averaging logic for samples
- **Threshold Derivation**: Test baseline + offset calculations
- Edge cases: single sample, many samples, negative values

### 10. Integration Test Updates (`tests/SettingsForm.test.tsx`)
- Added mock for `detection` API methods
- Updated test expectations to account for additional API calls
- Tests still pass with new component integrated

### 11. Documentation (`CALIBRATION.md`)
Created comprehensive documentation covering:
- User flow
- Technical implementation details
- Data flow diagrams
- Settings persistence
- UI features
- Testing guidelines
- Benefits

## Acceptance Criteria Met

✅ **Calibration flow collects baseline only when detection active and camera permission granted**
- Calibration button is disabled unless detection is running
- UI shows clear message about requirements
- IPC handler validates detection state

✅ **Baseline influences posture scoring/threshold, improving detection accuracy per user**
- PostureDetector applies baseline adjustment in calculatePostureScore()
- Angles are relative to user's calibrated position
- Threshold becomes baseline + allowed offset (personalized)

✅ **Calibration data persisted and survives restart**
- Settings stored in electron-store (persistent)
- Baseline and timestamp saved to detection settings
- Applied when detection starts after restart

## Testing Completed

### Unit Tests
- ✅ 11 tests for baseline calculation and application logic
- ✅ All tests passing

### Integration
- ✅ Settings form integration verified
- ✅ Type checking passes (main and preload)
- ✅ Build succeeds without errors

### Manual Testing Checklist
- [ ] Enable detection with camera permission
- [ ] Click "Calibrate Posture" button
- [ ] Observe 5-second countdown
- [ ] Verify baseline saved (timestamp displayed)
- [ ] Test posture detection with good posture
- [ ] Test posture detection with poor posture
- [ ] Restart app and verify baseline persists
- [ ] Recalibrate and verify new baseline applied
- [ ] Verify calibration disabled when detection stopped

## Files Modified
1. `src/types/settings.ts`
2. `src/renderer/components/SettingsForm.tsx`
3. `src/renderer/sensor/sensor.ts`
4. `src/preload/sensor.ts`
5. `src/main/ipc.ts`
6. `src/main/detectionState.ts`
7. `tests/SettingsForm.test.tsx`

## Files Created
1. `src/renderer/components/Calibration.tsx` - New calibration UI component
2. `tests/calibration.test.ts` - Unit tests for baseline logic
3. `CALIBRATION.md` - Feature documentation
4. `POSTURE_CALIBRATION_IMPLEMENTATION.md` - This file

## Technical Notes

### Calibration Duration
- 5 seconds = ~50-75 samples depending on FPS mode
- Sufficient to smooth out minor variations
- Not too long to be annoying for users

### Baseline Calculation
- Simple average of all head pitch samples
- Robust to outliers due to large sample size
- Uses smoothed values (EMA already applied by detector)

### Threshold Adjustment
```typescript
// Before calibration: absolute angle threshold
if (headPitch > 15°) { /* poor posture */ }

// After calibration: relative to user's baseline
const adjusted = headPitch - baseline;
if (adjusted > 15°) { /* poor posture */ }
```

### Error Handling
- 10-second timeout for calibration
- Clear error messages in UI
- Validation before starting calibration
- Graceful degradation if calibration fails

## Future Enhancements (Not in Scope)
- Visual feedback during calibration (camera feed preview)
- Multiple baseline profiles (work desk, couch, etc.)
- Automatic recalibration reminder after N days
- Export/import calibration settings
- Calibration quality score/confidence indicator
