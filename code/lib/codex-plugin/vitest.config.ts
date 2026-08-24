import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      include: ['toml.test.ts'],
    },
  })
);
