import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // 700 kB limit monitors the core application index chunk (currently ~650 kB after vendor separation).
    // Note: The PDF.js runtime chunk (~1.6 MB) is dynamically loaded on-demand via import('unpdf')
    // and does not block the initial page load.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@xyflow/react')) {
            return 'vendor-flow';
          }
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/immer')
          ) {
            return 'vendor-ui';
          }
          if (
            id.includes('node_modules/zod') ||
            id.includes('node_modules/zod-to-json-schema')
          ) {
            return 'vendor-schema';
          }
          if (id.includes('/src/presets/') || id.includes('\\src\\presets\\')) {
            return 'presets-data';
          }
        },
      },
    },
  },
});
