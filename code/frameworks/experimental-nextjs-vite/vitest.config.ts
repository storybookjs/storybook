// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.workspace';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    // Add custom config here
  })
);
