# Windows Build Configuration

This document describes the Windows NSIS installer configuration for the Wellness Reminder app.

## Overview

The app is configured to use electron-builder with NSIS (Nullsoft Scriptable Install System) for Windows packaging. The installer is configured for **per-user installation** without requiring administrator privileges.

## Configuration Files

### electron-builder.yml

Main configuration file for electron-builder with the following key settings:

- **appId**: `com.wellness.reminder`
- **productName**: `Wellness Reminder`
- **Output Directory**: `release/`
- **Build Resources**: `build/`

### Windows-Specific Settings

#### NSIS Configuration

The NSIS installer is configured with the following settings to meet per-user, no-admin requirements:

- **oneClick**: `true` - Single-click installation without prompts
- **perMachine**: `false` - Install for current user only (not system-wide)
- **allowElevation**: `false` - Do not request administrator privileges
- **allowToChangeInstallationDirectory**: `false` - Fixed installation location
- **createDesktopShortcut**: `true` - Creates a desktop shortcut
- **createStartMenuShortcut**: `true` - Creates a Start Menu shortcut
- **runAfterFinish**: `true` - Launches the app after installation

#### Icon Configuration

- **Location**: `build/icons/icon.ico`
- **Sizes**: 256x256, 128x128, 96x96, 64x64, 48x48, 32x32, 16x16 (multi-resolution .ico file)
- **Placeholder**: Blue background with white "W" letter

## Building

### Prerequisites

- Node.js v18 or later
- npm
- Windows OS (for actual installer creation)

### Build Commands

```bash
# Install dependencies
npm install

# Build the app (compiles TypeScript and bundles with Vite)
npm run build

# Create Windows installer
npm run dist

# Or specifically for Windows
npm run dist:win
```

### Build Output

The installer will be created in the `release/` directory with the filename:
```
Wellness Reminder-Setup-1.0.0.exe
```

## Files Included in Package

The following files are included in the packaged application:

- **dist-electron/main/main.js** - Main process compiled code
- **dist-electron/preload/index.js** - Preload script
- **dist-electron/renderer/** - Renderer process (HTML, CSS, JS)
- **package.json** - Package metadata
- **LICENSE** - ISC License file
- **node_modules** - Production dependencies

### electron-store Configuration

The `electron-store` package requires special handling:
- Unpacked from asar archive (configured via `asarUnpack`)
- Contains the settings schema for the app

## Installation Behavior

When users install the app:

1. **No UAC Prompt**: Installation proceeds without requiring administrator privileges
2. **User-Specific**: Installed to user's local AppData folder
3. **Shortcuts Created**: Desktop and Start Menu shortcuts are automatically created
4. **Auto-Launch**: App launches automatically after installation
5. **Single Instance**: Only one instance can run at a time

## Testing

To test the installer:

1. Build the installer on a Windows VM or machine
2. Run the generated `.exe` file
3. Verify:
   - No admin prompt appears
   - Installation completes without errors
   - Desktop and Start Menu shortcuts are created
   - App launches automatically
   - Tray icon appears
   - Reminder functionality works
   - Settings window opens correctly
   - App icon matches configuration

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `npm install`
- Verify TypeScript compilation: `npm run typecheck`
- Check build output: `npm run build`

### Icon Not Appearing

- Verify icon exists at `build/icons/icon.ico`
- Check icon format is valid Windows .ico format
- Ensure multiple resolutions are included

### Installation Requires Admin

- Verify `perMachine: false` in electron-builder.yml
- Verify `allowElevation: false` in electron-builder.yml
- Check that NSIS configuration is being used

### App Crashes on Launch

- Check that all required files are included in the package
- Verify electron-store is unpacked (asarUnpack configuration)
- Check main process logs for errors

## File Exclusions

The following files/directories are excluded from the package:

- Source code (`src/`)
- Tests (`tests/`)
- TypeScript configuration files (`tsconfig*.json`)
- Build configuration files (`*.config.ts`)
- Development config files (`.prettierrc.json`, `.eslintrc*`, etc.)
- Documentation (`README.md`, `PROJECT_SETUP.md`)
- Version control (`.git`, `.gitignore`)
- Source map files (`*.map`)
