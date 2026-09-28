import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { huertoApiPlugin } from './src/server/vitePlugin.ts'

export default defineConfig({
  plugins: [react(), huertoApiPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    watch: false,
  },
})
