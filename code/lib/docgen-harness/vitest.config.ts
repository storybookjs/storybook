import { defineConfig, mergeConfig } from 'vitest/config';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import vue from '@vitejs/plugin-vue';

import { svelteDocgen } from '../../frameworks/svelte-vite/src/plugins/svelte-docgen.ts';
import { transformPlugin as svelteCsfTransform } from '../../renderers/svelte/src/svelte-csf/compiler/plugins.ts';
import { vitestCommonConfig } from '../../vitest.shared.ts';

export default defineConfig(async () =>
  mergeConfig(
    vitestCommonConfig,
    defineConfig({
      plugins: [vue(), svelte(), await svelteDocgen(), await svelteCsfTransform(), svelteTesting()],
    })
  )
);
