import { defineConfig, mergeConfig } from 'vitest/config';
import type { Plugin } from 'vite';

import { transpileSync } from '@stencil/core/compiler';

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
      plugins: [
        stencilFixtures(),
        vue(),
        svelte(),
        await svelteDocgen(),
        svelteCsfPlugins,
        svelteTesting(),
      ],
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

// Stencil decorators only run through its compiler; this turns a fixture's `.tsx` into a self-defining custom element.
function stencilFixtures(): Plugin {
  return {
    name: 'docgen-harness:stencil-fixtures',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.tsx') || !code.includes("from '@stencil/core'")) {
        return undefined;
      }

      const { code: output, diagnostics } = transpileSync(code, {
        file: id,
        componentExport: 'customelement',
        sourceMap: false,
      });
      const errors = diagnostics.filter((diagnostic) => diagnostic.level === 'error');
      if (errors.length > 0) {
        this.error(errors.map((diagnostic) => diagnostic.messageText).join('\n'));
      }

      return { code: output, map: null };
    },
  };
}
