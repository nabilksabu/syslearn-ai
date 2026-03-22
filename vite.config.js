import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/gemini/, '')
      },
      '/groq': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/groq/, '')
      }
    }
  }
})
