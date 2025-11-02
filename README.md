# Wellness Reminder App

An Electron + TypeScript + React application for wellness reminders.

## Project Structure

```
├── src/
│   ├── main/         # Electron main process
│   ├── preload/      # Electron preload scripts
│   └── renderer/     # React renderer process
├── tests/            # Test files
├── build/            # Build resources
│   └── icons/        # Application icons
└── dist-electron/    # Build output
```

## Development

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

```bash
npm install
```

### Available Scripts

- `npm run dev` - Start the app in development mode
- `npm run start` - Alias for `npm run dev`
- `npm run build` - Build the renderer and compile TypeScript
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run dist` - Build distributable packages
- `npm run dist:win` - Build Windows installer specifically

### Building for Distribution

To create a Windows installer:

```bash
npm run dist:win
```

The installer will be created in the `release/` directory. For detailed Windows build configuration, see [WINDOWS_BUILD.md](./WINDOWS_BUILD.md).

**Note**: The Windows installer is configured for per-user installation and does not require administrator privileges.

## Tech Stack

- **Electron**: Desktop application framework
- **TypeScript**: Type-safe JavaScript
- **React**: UI library
- **Vite**: Build tool and dev server
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **electron-builder**: Application packaging
- **electron-store**: Data persistence
