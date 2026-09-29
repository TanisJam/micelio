import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { micelioApiPlugin } from './src/server/vitePlugin.ts'

export default defineConfig({
  plugins: [react(), micelioApiPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    watch: false,
  },
})
