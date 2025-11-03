import { Tray, Menu, nativeImage, app } from 'electron';
import { showSettingsWindow } from './window';
import { pauseManager } from './pauseManager';
import * as path from 'path';

let tray: Tray | null = null;

function createTrayIcon(): nativeImage {
  // Create a simple placeholder icon programmatically
  // 16x16 square with a simple pattern
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // Fill with a simple pattern (grey background with white border)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      // White border
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
        canvas[idx] = 255;     // R
        canvas[idx + 1] = 255; // G
        canvas[idx + 2] = 255; // B
        canvas[idx + 3] = 255; // A
      } else {
        // Grey interior
        canvas[idx] = 128;     // R
        canvas[idx + 1] = 128; // G
        canvas[idx + 2] = 128; // B
        canvas[idx + 3] = 255; // A
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
  });
}

function buildTrayMenu(): Menu {
  const pauseState = pauseManager.getState();
  const isPaused = pauseState.isPaused;

  const menuTemplate: any[] = [
    {
      label: 'Open Settings',
      click: () => {
        showSettingsWindow();
      },
    },
    {
      type: 'separator',
    },
  ];

  if (isPaused) {
    const timeRemaining = pauseState.pausedUntil
      ? Math.ceil((pauseState.pausedUntil - Date.now()) / 60000)
      : 0;
    menuTemplate.push({
      label: `⏸ Paused (${timeRemaining} min remaining)`,
      enabled: false,
    });
    menuTemplate.push({
      label: 'Resume',
      click: () => {
        pauseManager.resume();
      },
    });
  } else {
    menuTemplate.push({
      label: 'Pause All for 30 min',
      click: () => {
        pauseManager.pause(30);
      },
    });
  }

  menuTemplate.push({
    type: 'separator',
  });
  menuTemplate.push({
    label: 'Quit',
    click: () => {
      app.quit();
    },
  });

  return Menu.buildFromTemplate(menuTemplate);
}

function updateTrayMenu(): void {
  if (!tray) {
    return;
  }

  const contextMenu = buildTrayMenu();
  tray.setContextMenu(contextMenu);

  const pauseState = pauseManager.getState();
  if (pauseState.isPaused) {
    tray.setToolTip('Wellness Reminder - Paused');
  } else {
    tray.setToolTip('Wellness Reminder');
  }
}

export function createSystemTray(): void {
  if (tray) {
    return;
  }

  const icon = createTrayIcon();
  tray = new Tray(icon);

  updateTrayMenu();

  pauseManager.subscribe(() => {
    updateTrayMenu();
  });

  // Also show settings on click (for platforms that support it)
  tray.on('click', () => {
    showSettingsWindow();
  });
}

export function destroySystemTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
