# Manual Testing Guide for Posture Calibration

## Prerequisites
- Application built and running (`npm run dev`)
- Webcam connected and accessible
- System with posture detection capabilities

## Test Scenarios

### Scenario 1: Initial Calibration

**Objective**: Verify first-time calibration flow

**Steps**:
1. Launch the application
2. Navigate to Settings
3. Ensure "Detection Settings" section is visible
4. Enable "Enable camera-based detection" toggle
5. Grant camera permissions when prompted
6. Accept privacy consent
7. Wait for detection to start (green "Detection is running" indicator)
8. Scroll to "Posture Calibration" section
9. Verify button says "Calibrate Posture" (not "Recalibrate")
10. Click "Calibrate Posture" button

**Expected Results**:
- Button becomes disabled during calibration
- Large countdown timer appears (5...4...3...2...1)
- Instructions show "Sit upright in your ideal posture"
- After 5 seconds, calibration completes
- Green success message shows "Last calibrated: [timestamp]"
- Button text changes to "Recalibrate Posture"

### Scenario 2: Calibration Requirements

**Objective**: Verify calibration is only available when appropriate

**Steps**:
1. Launch application with detection DISABLED
2. Check "Posture Calibration" section

**Expected Results**:
- Button is disabled (grayed out)
- Warning message: "Calibration requires detection to be enabled and running..."

**Steps** (continued):
3. Enable detection but don't grant camera permission
4. Check calibration button

**Expected Results**:
- Button remains disabled
- Warning message still visible

**Steps** (continued):
5. Grant camera permission
6. Wait for camera to start
7. Check calibration button

**Expected Results**:
- Button is now enabled
- No warning message
- Can proceed with calibration

### Scenario 3: Calibration Cancel

**Objective**: Verify user can cancel during calibration

**Steps**:
1. Start calibration (with detection running)
2. During countdown (e.g., at 3 seconds), click "Cancel" button

**Expected Results**:
- Countdown stops immediately
- Calibration is aborted
- No baseline is saved
- Button returns to "Calibrate Posture" state
- No error messages shown

### Scenario 4: Recalibration

**Objective**: Verify users can recalibrate after initial calibration

**Steps**:
1. Complete initial calibration successfully
2. Note the timestamp shown
3. Wait a few seconds
4. Click "Recalibrate Posture" button
5. Sit in a different position (e.g., slouch slightly)
6. Complete the 5-second calibration

**Expected Results**:
- New calibration completes successfully
- Timestamp updates to current time
- New baseline is saved (different from first)
- Posture detection adjusts to new baseline

### Scenario 5: Baseline Persistence

**Objective**: Verify calibration survives app restart

**Steps**:
1. Complete calibration successfully
2. Note the exact timestamp shown
3. Close the application completely
4. Relaunch the application
5. Navigate to Posture Calibration section

**Expected Results**:
- Same calibration timestamp is displayed
- "Last calibrated" message shows same time
- Button shows "Recalibrate Posture" (not first-time calibration)
- Baseline is still applied to detection

### Scenario 6: Posture Detection with Baseline

**Objective**: Verify baseline improves detection accuracy

**Part A: Before Calibration**
1. Enable detection without calibrating
2. Sit in your normal working posture
3. Open browser console and watch posture metrics
4. Note the posture score values

**Part B: After Calibration**
5. Sit in ideal upright posture
6. Complete calibration
7. Return to normal working posture
8. Observe posture scores

**Expected Results**:
- Before calibration: Scores may incorrectly flag good posture as poor (or vice versa)
- After calibration: Scores are more accurate relative to YOUR baseline
- Deviation from calibrated position triggers alerts appropriately

### Scenario 7: Calibration During Poor Detection

**Objective**: Verify calibration with suboptimal camera conditions

**Steps**:
1. Start detection with camera partially blocked or poor lighting
2. Try to start calibration

**Possible Results**:
- Calibration may timeout if no posture data available
- Error message appears after 10 seconds
- User can retry once conditions improve

### Scenario 8: Multiple Feature Detection

**Objective**: Verify calibration only affects posture, not blink detection

**Steps**:
1. Enable both blink and posture detection
2. Complete posture calibration
3. Observe blink detection metrics

**Expected Results**:
- Blink detection continues working normally
- Blink metrics unchanged by posture calibration
- Only posture scores are affected by baseline

### Scenario 9: Settings UI Integration

**Objective**: Verify calibration component integrates well with settings

**Steps**:
1. Open Settings window
2. Scroll through all sections
3. Verify layout and spacing

**Expected Results**:
- Calibration section appears after Detection Settings
- Proper spacing and alignment
- No visual glitches or overlap
- Fits naturally in settings flow

### Scenario 10: Error Handling

**Objective**: Test error scenarios

**Test A: Calibration Timeout**
1. Start calibration
2. Cover camera immediately
3. Wait for timeout

**Expected Results**:
- After 10 seconds, timeout error appears
- Clear error message shown
- User can retry

**Test B: Detection Stops During Calibration**
1. Start calibration
2. Immediately disable detection (if possible via another window/process)

**Expected Results**:
- Calibration aborts gracefully
- Appropriate error message
- UI returns to normal state

## Validation Checklist

After completing all scenarios, verify:

- ✓ Calibration only works when detection is active
- ✓ Countdown displays correctly (5 seconds)
- ✓ Baseline is saved to settings
- ✓ Timestamp is displayed accurately
- ✓ Recalibration updates baseline
- ✓ Baseline persists after restart
- ✓ Cancel functionality works
- ✓ Error messages are clear and helpful
- ✓ UI is intuitive and well-integrated
- ✓ Posture detection accuracy improves with calibration

## Performance Checks

Monitor during calibration:
- CPU usage should not spike significantly
- No memory leaks
- UI remains responsive
- Countdown is smooth (no stuttering)

## Console Logging

Watch browser console during calibration for:
```
[Sensor] Posture calibration requested
[Sensor] Starting posture calibration (5 seconds)...
[Sensor] Calibration complete: baseline=X.XX° (N samples)
[IPC] Calibration result received: X.XX
[IPC] Baseline saved to settings
[IPC] Baseline applied to detection
[Sensor] Applied baseline pitch: X.XX°
```

## Known Limitations

1. Calibration requires stable camera position
2. User must maintain position for full 5 seconds
3. Poor lighting may affect calibration quality
4. Only head pitch is calibrated (not shoulder roll)

## Troubleshooting

**Problem**: Calibration button never enables
- **Solution**: Check camera permissions, enable detection, verify camera is working

**Problem**: Calibration completes but no timestamp shown
- **Solution**: Check browser console for errors, verify settings are saving

**Problem**: Baseline doesn't seem to apply
- **Solution**: Verify detection is running, check console for baseline application logs

**Problem**: Posture scores unchanged after calibration
- **Solution**: Ensure you're testing with different postures, check baseline value is reasonable
