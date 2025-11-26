import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../../vitest.shared';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    // Add custom config here
    test: {
      globals: true,
      setupFiles: ['src/test-setup.ts'],
    },
  })
);
