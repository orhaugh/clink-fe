import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The clink HTTP server sends no CORS headers, so the browser cannot call it
// cross-origin. In dev we proxy /api and /metrics to a running JobManager's
// HTTP listener. Point a JM at a fixed port and set VITE_CLINK_TARGET:
//
//   clink_node --role=jm --port=7070 --http-port=8081
//   VITE_CLINK_TARGET=http://127.0.0.1:8081 npm run dev
//
// SSE (/api/v1/events) is proxied too; http-proxy streams it without buffering.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_CLINK_TARGET || 'http://127.0.0.1:8081'
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      port: 5181,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/metrics': { target, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split the heavy, rarely-changing vendors so the app chunk stays
          // small and the charting lib only loads when its routes are hit.
          manualChunks: {
            recharts: ['recharts'],
            graph: ['@xyflow/react', '@dagrejs/dagre'],
            vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          },
        },
      },
    },
  }
})
