import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.workspace';

export default defineConfig(
  mergeConfig(vitestCommonConfig, {
    plugins: [
      import('@sveltejs/vite-plugin-svelte').then(({ svelte }) => svelte()),
      // @ts-expect-error -- types don't match our TS module resolution setting
      import('@testing-library/svelte/vite').then(({ svelteTesting }) => svelteTesting()),
    ],
    test: {
      environment: 'happy-dom',
    },
  })
);
