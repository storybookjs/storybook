import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.workspace';

export default defineConfig(
  mergeConfig(vitestCommonConfig, {
    plugins: [
      import('@sveltejs/vite-plugin-svelte').then(({ svelte, vitePreprocess }) =>
        svelte({ preprocess: vitePreprocess() })
      ),
    ],
  })
);
