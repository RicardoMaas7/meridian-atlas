import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The vite/rolldown versions bundled with vitest and @vitejs/plugin-react
  // disagree on a Plugin<>.hotUpdate signature; the runtime works either
  // way, so cast through unknown to keep both sides happy.
  plugins: [react() as unknown as never],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/graph/**/*.ts', 'src/parser/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/native/**'],
    },
  },
})