import { fileURLToPath } from 'node:url';

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
    resolve: {
      // The CSF factories template stories import the preview of the sandbox
      alias: {
        '#.storybook/preview': fileURLToPath(
          new URL('./src/__test__/svelte-csf-factories/preview.ts', import.meta.url)
        ),
      },
    },
    test: {
      environment: 'happy-dom',
      setupFiles: ['./vitest-setup.ts'],
    },
  })
);
