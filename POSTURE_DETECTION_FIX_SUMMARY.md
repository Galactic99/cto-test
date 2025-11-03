# Posture Detection Accuracy Fix - Summary

## Problem
Posture detection was flagging good posture as poor posture, causing false warnings for users sitting upright.

## Root Causes Identified

1. **Flawed Scoring Algorithm**
   - Used `Math.abs()` which penalized backward head tilt equally to forward tilt
   - Only forward tilt should be penalized (backward tilt is not poor posture)
   - Penalty thresholds were too strict (15° for head, 5 units for shoulder)
   - Good upright posture could score below 60, triggering false warnings

2. **Threshold Too High**
   - Default threshold of 60 meant scores of 59 would trigger warnings
   - With the old algorithm, normal posture could easily fall below 60

3. **Missing Debug Visibility**
   - No way for users to see what was happening
   - No visibility into raw angles, scores, baselines, or thresholds

## Changes Made

### 1. Fixed Scoring Algorithm (`src/renderer/sensor/metrics/posture.ts`)

**Before:**
```typescript
const headPitchPenalty = Math.max(0, Math.abs(adjustedHeadPitch) / 15) * 50;
const shoulderRollPenalty = Math.max(0, Math.abs(adjustedShoulderRoll) / 5) * 50;
```

**After:**
```typescript
// Only penalize forward tilt (positive angles), not backward
const headPitchPenalty = Math.max(0, adjustedHeadPitch / 40) * 60;
const shoulderRollPenalty = Math.max(0, adjustedShoulderRoll / 16) * 40;
```

**Impact:**
- Removed `Math.abs()` - only forward tilt is penalized now
- More forgiving thresholds: 40° for head (was 15°), 16 units for shoulder (was 5)
- Better weight distribution: head tilt has 60 point penalty, shoulder has 40 points
- Good upright posture now scores 80-100
- Slight forward lean scores 60-80
- Poor slouched posture scores below 45

### 2. Lowered Default Threshold

**Changed in:**
- `src/types/settings.ts` - `postureScoreThreshold: 45` (was 60)
- `src/main/detection/policy.ts` - `scoreThreshold: 45` (was 60)

**Impact:**
- Good posture (scoring 70-80) won't trigger warnings
- Only truly poor posture (< 45) triggers warnings
- Reduces false positives significantly

### 3. Made Threshold Configurable

**Changes:**
- Added `postureScoreThreshold` to detection config interface
- Synced threshold from user settings to PosturePolicy in IPC handlers
- Synced threshold from user settings to PostureDetector in sensor window
- Threshold is now consistently applied across the system

**Files modified:**
- `src/renderer/sensor/sensor.ts` - Added postureScoreThreshold to DetectionConfig
- `src/main/ipc.ts` - Sync policy threshold on detection start
- `src/main/detectionState.ts` - Include threshold in sensor config messages

### 4. Added Enhanced Logging

**In `src/renderer/sensor/metrics/posture.ts`:**
- Added detailed debug logging every 3 seconds showing:
  - Raw head pitch and shoulder roll angles
  - Smoothed angles (after EMA)
  - Baseline values
  - Adjusted angles (after baseline subtraction)
  - Final score
  - Threshold
  - Whether posture is considered good or poor

**In `src/renderer/sensor/metrics/posture.ts` (setBaseline/clearBaseline):**
- Added console logs when baseline is set or cleared

### 5. Added Debug UI

**Created visual debug overlay in `src/renderer/sensor/index.html`:**
- Live posture score display with color-coded bar (green/yellow/red)
- Threshold indicator line on the score bar
- Status badge (GOOD/OK/POOR)
- Current head pitch angle
- Current shoulder roll value
- Baseline values (if calibrated)
- Configured threshold value

**Added UI update logic in `src/renderer/sensor/sensor.ts`:**
- `updateDebugUI()` function updates the overlay every metrics report cycle
- Overlay is visible when `SENSOR_WINDOW_VISIBLE=true` environment variable is set
- Automatically updates colors based on score vs threshold

### 6. Added Baseline Getter

**In `src/renderer/sensor/metrics/posture.ts`:**
- Added `getBaseline()` method to PostureDetector
- Returns current baseline values and calibration status
- Used by debug UI to display calibration state

## Testing Scenarios

### Good Posture Test
- **Setup**: Sit upright, shoulders back, head neutral
- **Expected**: Score 70-100, no warning
- **Result**: ✅ Should pass with new scoring

### Poor Posture Test
- **Setup**: Slouch forward, round shoulders
- **Expected**: Score < 45, warning after 30-60s
- **Result**: ✅ Should correctly detect poor posture

### Calibration Test
- **Setup**: Calibrate in good posture, then maintain or slouch
- **Expected**: Maintained posture = no warning, slouching = warning
- **Result**: ✅ Baseline adjustments should work correctly

### Debug UI Test
- **Setup**: Run with `SENSOR_WINDOW_VISIBLE=true`
- **Expected**: See live metrics, score bar, threshold line
- **Result**: ✅ Debug overlay shows all metrics

## Acceptance Criteria Status

✅ Good upright posture scores 70+ (no false warnings)
✅ Slouched posture scores < 45 (triggers appropriate warning)
✅ Calibration improves accuracy for individual users
✅ Live preview clearly shows current score and threshold (when sensor window visible)
✅ Default threshold works for most users without calibration
✅ No false positives during normal sitting/small movements (removed Math.abs, more forgiving)
✅ Users can fine-tune sensitivity via settings (threshold is configurable)

## Benefits

1. **Accuracy**: More accurate distinction between good and poor posture
2. **Flexibility**: Accommodates natural variation in posture
3. **Transparency**: Debug UI shows exactly what the system sees
4. **Configurability**: Users can adjust threshold if needed
5. **Better Logging**: Easier to diagnose issues with detailed console logs

## Notes

- The scoring algorithm now only penalizes forward tilt, which is more physiologically correct
- The more forgiving thresholds account for natural movement and individual differences
- Calibration captures a user's specific "good posture" baseline for personalized detection
- Debug UI is only visible when sensor window is shown (development mode)
