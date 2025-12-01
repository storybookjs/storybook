import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export const vitestCommonConfig = defineConfig({
  test: {
    passWithNoTests: true,
    clearMocks: true,
    setupFiles: [resolve(__dirname, './vitest-setup.ts')],
    // Disable globals due to https://github.com/testing-library/user-event/pull/1176 not being released yet
    globals: false,
    testTimeout: 10000,
    environment: 'node',
  },
});
