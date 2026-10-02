import { loadSvelteConfig } from '@sveltejs/vite-plugin-svelte';
import {
  SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
  svelteCsfRuntimeStoriesPath,
  transformSvelteCsf,
} from '@storybook/svelte/internal/svelte-csf/transform';
import type { Plugin } from 'vite';

export async function svelteCsf(): Promise<Plugin> {
  const svelteConfig = await loadSvelteConfig();

  return {
    name: 'storybook:svelte-csf',
    resolveId(source) {
      if (source === SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE) {
        return svelteCsfRuntimeStoriesPath;
      }
    },
    async transform(compiledCode, id) {
      if (!/\.stories\.svelte$/.test(id)) {
        return undefined;
      }

      return transformSvelteCsf({
        filename: id,
        compiledCode,
        compiledAST: this.parse(compiledCode),
        preprocess: svelteConfig?.preprocess,
      });
    },
  };
}
