# Detection Live Preview Implementation

## Overview
Implemented a live metrics visualization component that displays real-time blink rate and posture score in the settings window, helping users configure detection settings with immediate feedback.

## Files Added

### `src/renderer/components/DetectionPreview.tsx`
Main component that displays live detection metrics with the following features:

**Key Features:**
- **Real-time Polling**: Fetches metrics every 2 seconds via `detection:metrics:get` IPC
- **Visual Status Indicators**: Color-coded status (green/yellow/red) based on health thresholds
- **Window Visibility Management**: Automatically pauses polling when window is hidden to conserve resources
- **Graceful Degradation**: Shows appropriate placeholder messages when detection is not running
- **Performance Conscious**: Uses cleanup functions to properly stop polling on unmount

**Health Thresholds:**
- Blink Rate: Healthy 12-25 blinks/min, Warning outside this range
- Posture Score: Good ≥70, Warning ≥50, Poor <50

**Props:**
- `isDetectionRunning: boolean` - Controls whether to poll for metrics

## Files Modified

### `src/renderer/components/SettingsForm.tsx`
- Added import for `DetectionPreview` component
- Integrated `DetectionPreview` between `DetectionSettings` and `Calibration` components
- Passes `isDetectionRunning` state from parent

## Tests Added

### `tests/DetectionPreview.test.tsx`
Comprehensive test suite with 23 test cases covering:

**Component States:**
- Detection not running (placeholder message)
- Detection running (loading and display states)
- Metrics display with various health status values

**Data Handling:**
- Healthy, warning, and poor status indicators
- Missing metrics (blink or posture data unavailable)
- Last updated timestamp display

**Lifecycle Management:**
- Initial metrics fetch on mount
- Polling at 2-second intervals
- Component unmount cleanup
- Detection start/stop transitions

**Performance Optimization:**
- Window visibility changes (pause/resume polling)
- No polling when window hidden
- Resume polling when window becomes visible

**Error Handling:**
- API errors handled gracefully without crashing

## Technical Implementation Details

### Polling Strategy
Uses `setInterval` inside a `useEffect` hook with proper cleanup:
```typescript
useEffect(() => {
  // Fetch immediately
  fetchMetrics();
  
  // Set up interval
  if (isDetectionRunning && isVisible) {
    intervalRef.current = setInterval(fetchMetrics, 2000);
  }
  
  // Cleanup
  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };
}, [isDetectionRunning, isVisible]);
```

### Visibility Management
Listens to `visibilitychange` event to pause/resume polling:
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    setIsVisible(!document.hidden);
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

## Acceptance Criteria Met

✅ **Real-time Metrics**: Preview reflects near-real-time metrics (2s polling) when detection running  
✅ **Placeholder Message**: Shows "Detection is not running" when detection inactive  
✅ **Resource Conservation**: Polling stops when window hidden or component unmounts  
✅ **Last Updated Time**: UI displays last updated timestamp  
✅ **Status Communication**: Color-coded indicators (green/yellow/red) show health status  
✅ **Performance**: Uses visibility API and proper cleanup to avoid unnecessary load

## Testing Results
- **23/23 tests passing** in DetectionPreview.test.tsx
- **372/372 total tests passing** across entire test suite
- No TypeScript errors in new files
- Proper cleanup prevents memory leaks

## Usage
The component is automatically displayed in the settings window when the user opens it. It will:
1. Show a placeholder when detection is disabled
2. Show "Loading metrics..." briefly when detection starts
3. Display live blink rate and posture score with color-coded status
4. Automatically pause updates when the settings window is minimized or hidden
5. Resume updates when the window becomes visible again
