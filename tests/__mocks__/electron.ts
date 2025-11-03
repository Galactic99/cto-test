export class Notification {
  constructor(_options: any) {
    // Mock implementation
  }

  show(): void {
    // Mock implementation
  }

  static isSupported(): boolean {
    return true;
  }
}

export const app = {
  setAppUserModelId: jest.fn(),
  requestSingleInstanceLock: jest.fn(() => true),
  on: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve()),
  quit: jest.fn(),
  setLoginItemSettings: jest.fn(),
  getLoginItemSettings: jest.fn(() => ({
    openAtLogin: false,
    openAsHidden: false,
    wasOpenedAtLogin: false,
    wasOpenedAsHidden: false,
    restoreState: false,
  })),
};

export const ipcMain = {
  handle: jest.fn(),
  removeHandler: jest.fn(),
  on: jest.fn(),
};

export const BrowserWindow = jest.fn();
