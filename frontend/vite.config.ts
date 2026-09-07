import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // proxy file upload/serving to the C++ backend so it's same-origin (no CORS)
    proxy: {
      '/upload': 'http://localhost:8080',
      '/files': 'http://localhost:8080',
    },
  },
})
