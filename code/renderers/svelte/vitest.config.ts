import { defineConfig, mergeConfig } from 'vitest/config';

import { svelteCsf } from '../../frameworks/svelte-vite/src/plugins/svelte-csf.ts';
import { vitestCommonConfig } from '../../vitest.shared.ts';

export default defineConfig(
  mergeConfig(vitestCommonConfig, {
    plugins: [
      import('@sveltejs/vite-plugin-svelte').then(({ svelte }) => svelte()),
      svelteCsf(),
      // @ts-expect-error -- types don't match our TS module resolution setting
      import('@testing-library/svelte/vite').then(({ svelteTesting }) => svelteTesting()),
    ],
    test: {
      environment: 'happy-dom',
      setupFiles: ['./vitest-setup.ts'],
    },
  })
);
