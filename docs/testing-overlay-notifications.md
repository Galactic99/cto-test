# Testing Overlay Notifications

This guide explains how to test the overlay notification system.

## Using the Settings UI

The easiest way to test overlay notifications is through the Settings UI:

1. Launch the application
2. Open the Settings window (from system tray or on startup)
3. Scroll to the "Blink Reminder" section
4. Click the **"Test Overlay"** button (purple button)
5. You should see a custom overlay notification appear in the top-right corner

Repeat the same for "Posture Reminder":
1. Scroll to the "Posture Reminder" section
2. Click the **"Test Overlay"** button (purple button)
3. You should see a posture overlay notification appear

## Expected Behavior

When you trigger an overlay notification, you should observe:

### Visual Appearance
- ✅ A notification card appears with a smooth slide-in animation from the right
- ✅ The notification has a colored accent bar at the top (blue for blink, purple for posture)
- ✅ The notification displays an icon, title, and body text
- ✅ A progress bar at the bottom shows the remaining time
- ✅ A dismiss button (×) is visible in the top-right corner

### Window Behavior
- ✅ The notification appears above all other windows (always-on-top)
- ✅ The notification does NOT activate or steal focus from your current window
- ✅ You can still click the dismiss button to manually close the notification
- ✅ The notification automatically dismisses after ~5 seconds

### Multiple Notifications
To test notification stacking:
1. Quickly click "Test Overlay" button multiple times
2. You should see notifications stack vertically without overlapping
3. Maximum of 3 notifications will be visible at once
4. Additional notifications will be queued and shown as older ones dismiss

### Animation
- Entry: Smooth slide-in from the right with fade-in
- Exit: Smooth slide-out to the right with fade-out
- Duration: Entry ~300ms, Exit ~250ms

## Comparing with Toast Notifications

The Settings UI provides both "Test Toast" and "Test Overlay" buttons:

- **Test Toast**: Shows the legacy Windows toast notification
- **Test Overlay**: Shows the new custom overlay notification

Compare the two to see the differences:
- Overlay notifications are always visible and customizable
- Toast notifications use the OS native style and positioning
- Overlay notifications support stacking and animations
- Overlay notifications don't steal focus

## Troubleshooting

### Notification doesn't appear
- Check if the notification window is created (check main process logs)
- Ensure no antivirus software is blocking overlay windows
- Try restarting the application

### Notification appears but looks broken
- Check browser console in notification window (requires dev tools)
- Verify the notification renderer HTML/CSS loaded correctly
- Check for JavaScript errors in the renderer process

### Notification steals focus
- This should not happen - the window is configured as non-focusable
- If it does, report as a bug - window flags may need adjustment

### Multiple notifications overlap
- This should not happen - check the stacking logic
- Verify the notification container CSS is working correctly

## Advanced Testing

### Manual IPC Testing
From the renderer DevTools console, you can test the IPC bridge:

```javascript
// Test blink overlay
await window.electronAPI.overlay.testBlink()

// Test posture overlay
await window.electronAPI.overlay.testPosture()
```

### Programmatic Testing
From the main process, you can programmatically show notifications:

```typescript
import { getNotificationManager } from './system/NotificationManager';

const manager = getNotificationManager();

// Show custom notification
manager.show(
  'Custom Title',
  'Custom message body',
  'blink',
  { timeout: 10000 }
);
```

## Known Limitations

- Notifications are positioned relative to the primary display
- No support for multi-monitor positioning preferences yet
- No support for notification sounds
- No support for notification actions (buttons)
- Maximum of 3 visible notifications at once (configurable)

## Future Enhancements

Planned improvements:
- Sound effects
- Click actions
- Rich content (images, buttons)
- Multi-monitor awareness
- Per-monitor positioning
- Notification history
- Do not disturb integration
