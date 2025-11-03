import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';

function copyMediaPipeAssets() {
  return {
    name: 'copy-mediapipe-assets',
    closeBundle() {
      const srcDir = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
      const destDir = path.resolve(__dirname, 'dist-electron/renderer/wasm');

      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        
        const files = fs.readdirSync(srcDir);
        files.forEach(file => {
          if (file.endsWith('.wasm') || file.endsWith('.js') || file.endsWith('.data')) {
            fs.copyFileSync(
              path.join(srcDir, file),
              path.join(destDir, file)
            );
            console.log(`Copied MediaPipe asset: ${file}`);
          }
        });
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'src/preload/sensor.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
    copyMediaPipeAssets(),
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist-electron/renderer',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        sensor: path.resolve(__dirname, 'src/renderer/sensor/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
