import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'happy-dom'
  }
})
