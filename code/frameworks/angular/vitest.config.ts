import { defineConfig, mergeConfig } from 'vite-plus';

import { vitestCommonConfig } from '../../vitest.shared';

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
