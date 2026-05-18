import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/admin-react/dist/', // Flask servirá los assets desde aquí
  build: {
    outDir: '../static/admin-react/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/static': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})

