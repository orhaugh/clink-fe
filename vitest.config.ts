import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// Test config is kept separate from vite.config.ts so the dev-server proxy
// block never loads under the runner. jsdom gives components a DOM; the setup
// file wires jest-dom matchers and auto-cleanup.
// The console's own version, from package.json, shown beside the engine's.
const consoleVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  .version as string

export default defineConfig({
  plugins: [react()],
  define: { __CONSOLE_VERSION__: JSON.stringify(consoleVersion) },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'lcov', 'json-summary'],
      // Logic-bearing code is the coverage target; exclude generated/config,
      // the hand-written shadcn primitives (thin Radix wrappers), and type-only
      // declarations that carry no runtime branches.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/components/ui/**',
      ],
      // Ratchet: the logic core (lib/ + the SSE hook) is hard-gated at the
      // coverage it actually achieves, so a regression fails CI. UI pages are
      // not gated yet - grow their coverage and add thresholds over time.
      thresholds: {
        'src/lib/prometheus.ts': { statements: 95, branches: 90, functions: 100, lines: 95 },
        'src/lib/types.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/api.ts': { statements: 95, branches: 90, functions: 100, lines: 95 },
        'src/lib/utils.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/hooks/useEvents.ts': { statements: 95, branches: 90, functions: 100, lines: 95 },
        'src/lib/guarantees.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/recovery.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/endpoints.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/lib/fleet.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/progress.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/auth.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/sse.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/connection.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/lib/roles.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
})
