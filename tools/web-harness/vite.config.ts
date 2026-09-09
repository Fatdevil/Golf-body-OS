import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../../src/core'),
      '@protocols': path.resolve(__dirname, '../../src/protocols')
    }
  },
  server: {
    host: true,
    port: 5173
  }
})
