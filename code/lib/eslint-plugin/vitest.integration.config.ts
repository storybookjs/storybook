import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/tests/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 60000,
  },
});
