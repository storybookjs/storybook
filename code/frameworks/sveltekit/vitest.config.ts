import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    plugins: [import('@sveltejs/vite-plugin-svelte').then(({ svelte }) => svelte())],
  })
);
