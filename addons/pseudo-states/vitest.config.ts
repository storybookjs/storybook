import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      typecheck: {
        enabled: true,
      },
    },
  })
);
