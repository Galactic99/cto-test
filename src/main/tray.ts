import { Tray, Menu, nativeImage, app } from 'electron';
import { showSettingsWindow } from './window';
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

export function createSystemTray(): void {
  if (tray) {
    return;
  }

  const icon = createTrayIcon();
  tray = new Tray(icon);

  tray.setToolTip('Wellness Reminder');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        showSettingsWindow();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

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
