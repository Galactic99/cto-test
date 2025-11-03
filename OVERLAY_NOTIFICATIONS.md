# Overlay Notification System

This document describes the overlay notification system architecture and implementation.

## Overview

The overlay notification system provides frameless, transparent, always-on-top notification windows with:
- Smooth fade and slide animations
- Configurable screen positioning (top-right, bottom-right, top-left, bottom-left)
- Notification stacking and queuing
- Type-specific styling (blink vs posture)
- Auto-dismiss with progress indicator
- Manual dismiss button
- No focus stealing from the main application

## Architecture

### Components

#### 1. Notification Manager (`src/main/system/NotificationManager.ts`)
- Manages a persistent BrowserWindow for displaying notifications
- Handles notification queue and stacking
- Calculates screen positioning
- Provides API for showing, dismissing, and configuring notifications

**Key Features:**
- Frameless, transparent window
- Always-on-top with screen-saver level priority
- Non-focusable to prevent stealing focus
- Visible on all workspaces including fullscreen
- Queue management to respect max visible limit

**API:**
```typescript
class NotificationManager {
  show(title: string, body: string, type: 'blink' | 'posture', options?: { icon?: string; timeout?: number }): string
  dismiss(id: string): void
  updateConfig(config: Partial<NotificationConfig>): void
  setPosition(position: NotificationPosition): void
  destroy(): void
}

// Singleton access
getNotificationManager(): NotificationManager
destroyNotificationManager(): void
```

#### 2. Notification Renderer (`src/renderer/notifications/`)
- React-based renderer process for notification UI
- Handles notification animations and lifecycle
- Responds to IPC events from main process

**Files:**
- `index.html` - HTML mount point
- `index.tsx` - React entry point
- `index.css` - Animations and styling
- `NotificationContainer.tsx` - Container managing all active notifications
- `NotificationItem.tsx` - Individual notification component

#### 3. Preload Script (`src/preload/notifications.ts`)
- Exposes secure IPC bridge between main and renderer
- Provides API for notification lifecycle events

**API:**
```typescript
interface NotificationsAPI {
  onShowNotification: (callback: (payload: NotificationPayload) => void) => void
  onDismissNotification: (callback: (id: string) => void) => void
  onUpdateConfig: (callback: (config: NotificationConfig) => void) => void
  notifyDismissed: (id: string) => void
  notifyExpired: (id: string) => void
}
```

#### 4. Type Definitions (`src/types/notification.ts`)
- Shared types for notification system
- Configuration defaults

**Key Types:**
```typescript
type NotificationType = 'blink' | 'posture'
type NotificationPosition = 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'

interface NotificationPayload {
  id: string
  title: string
  body: string
  type: NotificationType
  icon?: string
  timeout?: number
  position?: NotificationPosition
}

interface NotificationConfig {
  position: NotificationPosition
  maxVisible: number
  defaultTimeout: number
}
```

## Usage

### Testing Overlay Notifications

The settings UI provides test buttons for overlay notifications:
- **Blink Reminder** section: "Test Overlay" button
- **Posture Reminder** section: "Test Overlay" button

### Programmatic Usage

```typescript
import { getNotificationManager } from './system/NotificationManager';

const manager = getNotificationManager();

// Show a notification
const id = manager.show(
  'Time to blink',
  'Look away for 20 seconds to rest your eyes',
  'blink',
  { timeout: 5000 }
);

// Dismiss a notification
manager.dismiss(id);

// Change position
manager.setPosition('bottom-right');

// Update configuration
manager.updateConfig({
  position: 'top-left',
  maxVisible: 5,
  defaultTimeout: 8000,
});
```

### IPC Handlers

The main process exposes the following IPC handlers for testing:
- `overlay:test-blink` - Show a test blink notification
- `overlay:test-posture` - Show a test posture notification

## Styling

### Notification Types

#### Blink Notifications
- Accent color: Blue gradient (`#3b82f6` to `#60a5fa`)
- Icon background: Blue gradient
- Default icon: 👁️

#### Posture Notifications
- Accent color: Purple gradient (`#8b5cf6` to `#a78bfa`)
- Icon background: Purple gradient
- Default icon: 🪑

### Animations

- **Entry:** `slideInRight` or `slideInLeft` (300ms, ease-out)
- **Exit:** `slideOutRight` or `slideOutLeft` (250ms, ease-in)
- Animations adapt based on screen position

### Theme

Notifications use a dark theme with:
- Background: Semi-transparent dark (`rgba(30, 30, 30, 0.95)`)
- Backdrop blur for depth
- Subtle border and shadow
- Progress bar showing remaining time

## Configuration

### Default Configuration

```typescript
{
  position: 'top-right',
  maxVisible: 3,
  defaultTimeout: 5000
}
```

### Position Calculation

The notification window spans the entire primary display but is transparent. Notifications are positioned within this window using CSS based on the configured position.

## Window Flags

The notification window is configured with specific flags to ensure proper behavior:

```typescript
{
  transparent: true,          // Transparent background
  frame: false,              // Frameless window
  alwaysOnTop: true,         // Always on top
  skipTaskbar: true,         // Don't show in taskbar
  focusable: false,          // Don't steal focus
  hasShadow: false,          // No window shadow
  setAlwaysOnTop: 'screen-saver', // Highest priority
  setVisibleOnAllWorkspaces: true, // Show on all desktops
}
```

## Integration Points

### Build Configuration

The notification renderer is configured in `vite.config.ts`:
- Entry point: `src/renderer/notifications/index.html`
- Preload script: `src/preload/notifications.ts`
- Output: `dist-electron/renderer/notifications.html`

### Main Process Initialization

The NotificationManager is lazily initialized on first use via `getNotificationManager()`. It should be destroyed on app quit:

```typescript
app.on('before-quit', () => {
  destroyNotificationManager();
});
```

## Future Enhancements

Potential improvements for the notification system:
- Sound effects for notifications
- Notification actions (buttons)
- Rich content support (images, progress bars)
- Notification history
- Do not disturb mode integration
- Per-notification-type positioning
- Drag to dismiss gesture
- Notification grouping/collapsing
