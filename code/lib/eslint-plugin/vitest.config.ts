import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      // This is needed because @typescript-eslint/rule-tester API requires it under the hood
      globals: true,
    },
  })
);
