import { defineConfig, mergeConfig } from 'vitest/config';

import { viteFinal as svelteCsfViteFinal } from '@storybook/addon-svelte-csf/preset';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import vue from '@vitejs/plugin-vue';

import { svelteDocgen } from '../../frameworks/svelte-vite/src/plugins/svelte-docgen.ts';
import { vitestCommonConfig } from '../../vitest.shared.ts';

export default defineConfig(async () => {
  const { plugins: svelteCsfPlugins } = await svelteCsfViteFinal!({ plugins: [] }, {
    legacyTemplate: false,
  } as unknown as Parameters<Exclude<typeof svelteCsfViteFinal, undefined>>[1]);

  return mergeConfig(
    vitestCommonConfig,
    defineConfig({
      plugins: [vue(), svelte(), await svelteDocgen(), svelteCsfPlugins, svelteTesting()],
      test: {
        server: {
          deps: {
            inline: ['@storybook/addon-svelte-csf'],
          },
        },
      },
    })
  );
});
