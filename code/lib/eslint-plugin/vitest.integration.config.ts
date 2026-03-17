import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['**/tests/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 60000,
  },
});
