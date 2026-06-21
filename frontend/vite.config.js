import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api and /ws to the backend during local development. The backend
// origin is read from VITE_API_URL (defaults to http://localhost:8000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_API_URL || 'http://localhost:8000'
  const wsBackend = backend.replace(/^http/, 'ws')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: wsBackend,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
