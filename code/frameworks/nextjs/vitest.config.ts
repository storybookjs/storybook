import { resolve } from 'node:path';

import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    resolve: {
      alias: {
        // These packages are not built when running the unit tests here, so they are
        // resolved from their source like their `code` export condition does.
        '@storybook/builder-webpack5': resolve(
          __dirname,
          '../../builders/builder-webpack5/src/index.ts'
        ),
        'storybook/internal/common': resolve(__dirname, '../../core/src/common/index.ts'),
      },
    },
  })
);
