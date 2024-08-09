/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig, mergeConfig } from 'vitest/config';

import vue from '@vitejs/plugin-vue';

import { vitestCommonConfig } from '../../vitest.workspace';

export default mergeConfig(
  vitestCommonConfig,
  // @ts-expect-error seems like there's a type mismatch in the vue plugin
  defineConfig({
    // @ts-expect-error seems like there's a type mismatch in the vue plugin
    plugins: [vue()],
  })
);
