# Windows Camera Permissions Guide

This guide will help you enable camera access for the Wellness Reminder application on Windows 10 and Windows 11.

## Why Does the App Need Camera Access?

The Wellness Reminder app uses your camera locally to:
- **Detect blinks**: Monitor your eye health and remind you to take breaks
- **Track posture**: Help you maintain proper posture throughout the day

**Important**: All camera processing happens entirely on your device. No images or video are stored, transmitted, or shared.

## Enabling Camera Access on Windows 11

### Step 1: Open Windows Settings
1. Click the **Start** button (Windows icon)
2. Click **Settings** (gear icon)
3. Or press `Windows + I` on your keyboard

### Step 2: Navigate to Privacy & Security
1. In the Settings window, click **Privacy & security** in the left sidebar
2. Scroll down and click **Camera** under "App permissions"

### Step 3: Enable Camera Access
1. Make sure **Camera access** is turned **On** (toggle should be blue)
2. Make sure **Let apps access your camera** is turned **On**
3. Scroll down to **Let desktop apps access your camera**
4. Make sure this is turned **On**

### Step 4: Restart the App
1. Close the Wellness Reminder app completely
2. Reopen the app and try enabling detection again

## Enabling Camera Access on Windows 10

### Step 1: Open Windows Settings
1. Click the **Start** button (Windows icon)
2. Click **Settings** (gear icon)
3. Or press `Windows + I` on your keyboard

### Step 2: Navigate to Privacy Settings
1. Click **Privacy**
2. In the left sidebar, scroll down and click **Camera**

### Step 3: Enable Camera Access
1. Make sure **Allow access to the camera on this device** is turned **On**
   - If it's off, click **Change** and turn it on
2. Make sure **Allow apps to access your camera** is turned **On** (toggle should be blue)
3. Scroll down to **Choose which Microsoft Store apps can access your camera**
4. Make sure **Allow desktop apps to access your camera** is turned **On**

### Step 4: Restart the App
1. Close the Wellness Reminder app completely
2. Reopen the app and try enabling detection again

## Troubleshooting

### Camera Still Not Working?

If you've followed the steps above and the camera still isn't working, try these solutions:

#### 1. Check if Another App is Using the Camera
- Close any other apps that might be using your camera (Zoom, Teams, Skype, etc.)
- Restart the Wellness Reminder app

#### 2. Restart Your Computer
Sometimes Windows needs a restart for permission changes to take effect.

#### 3. Check Camera Hardware
1. Open the Windows **Camera** app to verify your camera is working
2. If the Camera app doesn't work either, there may be a hardware issue

#### 4. Update Camera Drivers
1. Right-click the **Start** button
2. Select **Device Manager**
3. Expand **Cameras** or **Imaging devices**
4. Right-click your camera device
5. Select **Update driver**
6. Choose **Search automatically for drivers**

#### 5. Check Antivirus/Security Software
Some antivirus or security software may block camera access. Check your security software settings and add the Wellness Reminder app to the allowed list if needed.

#### 6. Windows Camera Privacy Settings (Advanced)
In some cases, Windows may have additional privacy settings:
1. Open **Settings** → **Privacy & security** (Windows 11) or **Privacy** (Windows 10)
2. Check **Microphone** and other privacy settings
3. Ensure no group policy or enterprise settings are blocking camera access

## Still Having Issues?

If you're still experiencing problems after trying all the troubleshooting steps:

1. Make sure you're running the latest version of Windows
2. Check for Windows updates: **Settings** → **Windows Update**
3. Consider reinstalling the app
4. Check the app's GitHub repository for known issues and solutions

## Privacy Information

**Your privacy is our top priority:**
- All camera processing happens locally on your device
- No images, video, or camera data are stored
- No camera data is transmitted over the internet
- No camera data is shared with third parties
- You can disable camera features at any time in the app settings

For more information, see our [Privacy Policy](https://github.com/Galactic99/cto-test/blob/main/PRIVACY.md).
