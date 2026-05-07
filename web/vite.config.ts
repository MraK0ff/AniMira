import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  base: '/',  // Относительные пути — работает и локально и на Render
  build: {
    sourcemap: false,  // Отключаем source maps
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
