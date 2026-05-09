import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  base: '/',  // Относительные пути — работает и локально и на Render
  define: {
    // Убедимся что API_URL не переопределяется
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
  },
  build: {
    sourcemap: false,  // Отключаем source maps
    chunkSizeWarningLimit: 600,  // Allow chunks up to 600KB without warning
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React ecosystem
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'vendor-react';
          }
          // Data fetching
          if (id.includes('@tanstack')) {
            return 'vendor-query';
          }
          // UI libraries
          if (id.includes('lucide-react') || id.includes('clsx')) {
            return 'vendor-ui';
          }
          // Video player
          if (id.includes('hls.js')) {
            return 'vendor-video';
          }
          // All other node_modules go to vendor
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Проксируем /api/* на бэкенд (FastAPI)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // rewrite убираем — FastAPI ожидает /api/ префикс
      },
    },
  },
})
