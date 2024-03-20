/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestCommonConfig } from '../../vitest.workspace';

export default defineConfig(
  mergeConfig(vitestCommonConfig, {
    test: {
      environment: 'jsdom',
      // setupFiles: ['./vitest-setup.ts'],
    },
    plugins: [
      // eslint-disable-next-line import/no-unresolved
      import('@sveltejs/vite-plugin-svelte').then(({ svelte, vitePreprocess }) =>
        svelte({ preprocess: vitePreprocess() })
      ),
    ],
  })
);
