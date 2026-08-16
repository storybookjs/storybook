import { defineConfig, mergeConfig } from 'vitest/config';

import { textAssetLoaderPlugins, vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    plugins: [...textAssetLoaderPlugins],
  })
);
