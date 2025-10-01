import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
