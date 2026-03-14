import { defineConfig, mergeConfig } from 'vite-plus';

import { vitestCommonConfig } from '../../vitest.shared';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      setupFiles: ['./vitest-setup.ts'],
    },
  })
);
