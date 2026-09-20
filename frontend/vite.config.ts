import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Verify if recharts is present in node_modules, else gracefully fall back to zero-dependency SVG charts
const rechartsExists = fs.existsSync(path.resolve(__dirname, './node_modules/recharts'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...(!rechartsExists
        ? { recharts: path.resolve(__dirname, './src/components/ui/charts-fallback.tsx') }
        : {}),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
