# Blink Policy Implementation

## Overview

This implementation adds intelligent blink rate monitoring with hysteresis-based policy logic to trigger assistive reminders when users aren't blinking enough.

## Architecture

### 1. Blink Rate Aggregator (`src/renderer/sensor/metrics/aggregators.ts`)

**Purpose:** Maintains a rolling window of blink events and computes accurate blinks-per-minute metrics.

**Key Features:**
- **Rolling Window:** Configurable window duration (default: 3 minutes / 180,000ms)
- **Event Tracking:** Stores blink events with timestamps
- **Automatic Cleanup:** Removes events older than the window duration
- **Accurate Calculation:** Computes blink rate based on actual time span of events

**API:**
```typescript
const aggregator = createBlinkRateAggregator(3); // 3-minute window
aggregator.addEvent(timestamp);
const metrics = aggregator.getMetrics(); // { blinksPerMinute, eventCount, windowDurationMs }
aggregator.reset();
```

**Algorithm:**
- For 2+ events: `blinksPerMinute = eventCount / (currentTime - oldestEvent) * 60000`
- For 1 event: `blinksPerMinute = 1 / eventAge * 60000` (if within window)
- For 0 events: `blinksPerMinute = 0`

### 2. Blink Policy (`src/main/detection/policy.ts`)

**Purpose:** Evaluates aggregated blink metrics and triggers notifications based on configurable thresholds and cooldown periods.

**Key Features:**
- **Threshold Detection:** Default 9 blinks/minute (configurable)
- **Required Duration:** Must be below threshold for 60 seconds before triggering
- **Cooldown Enforcement:** 10-minute cooldown between notifications (configurable)
- **State Persistence:** Maintains state across detection pauses
- **Hysteresis Logic:** Prevents notification spam from fluctuating rates

**Configuration:**
```typescript
const policy = createBlinkPolicy({
  thresholdBpm: 9,                    // Trigger below this rate
  cooldownMs: 10 * 60 * 1000,        // 10 minutes between notifications
  requiredDurationMs: 60 * 1000,     // Must be low for 1 minute
});
```

**State Machine:**
1. **Normal:** Blink rate ≥ threshold
2. **Low Rate Detected:** Rate drops below threshold, start timer
3. **Notification Triggered:** Low rate for ≥ required duration, not in cooldown
4. **Cooldown:** After notification, suppress further notifications for cooldown period

**API:**
```typescript
policy.evaluate(blinksPerMinute, timestamp);
policy.reset(); // Clear state (e.g., when detection starts)
policy.updateConfig({ thresholdBpm: 12 }); // Update configuration
const state = policy.getState(); // Get current state
```

### 3. Integration

#### Sensor Window (`src/renderer/sensor/sensor.ts`)

**Changes:**
- Initialize `BlinkRateAggregator` alongside `BlinkDetector`
- Track blink events: When `BlinkDetector` detects a new blink, add event to aggregator
- Report metrics: Every 5 seconds, send aggregated metrics to main process via IPC

**Metrics Reporting:**
```typescript
window.sensorAPI.sendMetricsUpdate({
  blink: {
    timestamp: now,
    blinkCount: aggregatedMetrics.eventCount,
    blinkRate: aggregatedMetrics.blinksPerMinute,
  },
});
```

#### IPC Handler (`src/main/ipc.ts`)

**Changes:**
- Create global `blinkPolicy` instance
- On `sensor:metrics-update`: Evaluate policy with new blink rate
- On `detection:start`: Reset policy state for new session

**Evaluation Flow:**
```typescript
ipcMain.on('sensor:metrics-update', (_event, metrics) => {
  if (metrics.blink && detectionState.isDetectionRunning()) {
    blinkPolicy.evaluate(metrics.blink.blinkRate, metrics.blink.timestamp);
  }
});
```

## Notification Behavior

### Detection-Based Notification
**Title:** "Low blink rate detected"
**Body:** "You're blinking {X} times per minute. Remember to blink regularly to keep your eyes healthy."

This is **distinct** from the timer-based reminder:
- **Timer-based:** "Time to blink" / "Look away for 20 seconds to rest your eyes"
- **Detection-based:** Triggered by actual low blink rate, not time interval

## Testing

### Test Coverage

#### Aggregator Tests (`tests/blinkRateAggregator.test.ts`)
- ✅ Rolling window calculations (1, 2, 3 minute periods)
- ✅ Event cleanup (removes old events)
- ✅ Edge cases (boundary conditions, rapid succession, sparse events)
- ✅ Multi-minute tracking with varying rates
- ✅ Window size configuration (2-3 minute windows)

**Total: 21 tests, all passing**

#### Policy Tests (`tests/blinkPolicy.test.ts`)
- ✅ Threshold detection (above/below/at threshold)
- ✅ Cooldown enforcement (10-minute cooldown)
- ✅ Required duration (must be low for 60 seconds)
- ✅ State persistence and reset
- ✅ Configuration updates
- ✅ Continuous monitoring scenarios
- ✅ Edge cases (zero rate, high rate, fractional rates)

**Total: 32 tests, all passing**

### Running Tests

```bash
# Run all new tests
npm test -- blinkRateAggregator blinkPolicy

# Run aggregator tests only
npm test -- blinkRateAggregator.test.ts

# Run policy tests only
npm test -- blinkPolicy.test.ts
```

## Configuration Options

### Aggregator
- `windowDurationMinutes`: Duration of rolling window (default: 3 minutes)

### Policy
- `thresholdBpm`: Blink rate threshold in blinks per minute (default: 9)
- `cooldownMs`: Cooldown period between notifications in milliseconds (default: 600,000 = 10 minutes)
- `requiredDurationMs`: Duration rate must be below threshold before triggering (default: 60,000 = 1 minute)

## Behavioral Characteristics

### Hysteresis
The system implements hysteresis to prevent notification spam:
1. Rate must stay below threshold for full `requiredDurationMs` (1 minute)
2. If rate returns to normal during this period, timer resets
3. After notification, cooldown period prevents re-notification
4. Cooldown persists even if rate returns to normal temporarily

### State Persistence
Policy state is maintained across:
- ✅ Continuous detection sessions
- ✅ Metrics updates (every 5 seconds)
- ❌ Detection stop/start (state resets on new session)

### Example Scenarios

**Scenario 1: Sustained Low Rate**
- Time 0:00 - Rate drops to 8 bpm
- Time 1:00 - Notification triggered (low for 60 seconds)
- Time 5:00 - Still low, no notification (cooldown)
- Time 11:00 - Notification triggered again (cooldown expired)

**Scenario 2: Fluctuating Rate**
- Time 0:00 - Rate drops to 8 bpm
- Time 0:30 - Rate returns to 10 bpm (timer resets)
- Time 0:45 - Rate drops to 8 bpm again (new timer starts)
- Time 1:45 - Notification triggered (low for 60 seconds from 0:45)

**Scenario 3: Brief Dip**
- Time 0:00 - Rate drops to 8 bpm
- Time 0:45 - Rate returns to 10 bpm
- Result: No notification (wasn't low for full minute)

## Performance Considerations

### Memory Usage
- Aggregator stores timestamps only (8 bytes each)
- At 30 bpm × 3 minutes = ~90 events = 720 bytes
- Automatic cleanup prevents unbounded growth

### CPU Usage
- Metrics reported every 5 seconds (not per frame)
- Policy evaluation is O(1) per update
- Aggregator cleanup is O(n) where n = events in window (typically < 100)

## Future Enhancements

### Potential Improvements
1. **Adaptive Thresholds:** Learn user's normal blink rate, adjust threshold accordingly
2. **Time-of-Day Awareness:** Different thresholds for different times (e.g., higher in afternoon)
3. **Progressive Notifications:** Escalate notification urgency if rate stays very low
4. **Settings UI:** Allow users to configure threshold and cooldown
5. **Analytics:** Track blink rate trends over time

### Integration Opportunities
1. **Break Reminders:** Coordinate with posture reminders
2. **Activity Detection:** Pause during breaks or when user is away
3. **Focus Mode:** Suppress notifications during focused work periods
