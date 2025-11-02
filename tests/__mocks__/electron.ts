export class Notification {
  private options: any;

  constructor(options: any) {
    this.options = options;
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
};

export const ipcMain = {
  handle: jest.fn(),
  removeHandler: jest.fn(),
  on: jest.fn(),
};

export const BrowserWindow = jest.fn();
