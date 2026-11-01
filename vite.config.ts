import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// In dev we proxy /api and /metrics to a running Coordinator's HTTP listener,
// so no CORS setup is needed (cross-origin deployments can instead use
// clink_node --http-cors-origin=<origin>). Point a Coordinator at a fixed
// port and set VITE_CLINK_TARGET:
//
//   clink_node --role=coordinator --port=7070 --http-port=8081
//   VITE_CLINK_TARGET=http://127.0.0.1:8081 npm run dev
//
// SSE (/api/v1/events) is proxied too; http-proxy streams it without buffering.
// The console's own version, from package.json, shown beside the engine's.
const consoleVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  .version as string

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_CLINK_TARGET || 'http://127.0.0.1:8081'
  return {
    plugins: [react()],
    define: { __CONSOLE_VERSION__: JSON.stringify(consoleVersion) },
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
          // Groups match in order, so recharts and the graph stack claim
          // their modules before the general vendor group.
          advancedChunks: {
            groups: [
              { name: 'recharts', test: /node_modules[\\/]recharts[\\/]/ },
              { name: 'graph', test: /node_modules[\\/](@xyflow|@dagrejs)[\\/]/ },
              {
                name: 'vendor',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack)[\\/]/,
              },
            ],
          },
        },
      },
    },
  }
})
