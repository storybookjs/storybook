import { loadSvelteConfig } from '@sveltejs/vite-plugin-svelte';
import {
  SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
  svelteCsfRuntimeStoriesPath,
  transformSvelteCsf,
} from '@storybook/svelte/internal/svelte-csf/transform';
import type { Plugin } from 'vite';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function svelteCsf(): Promise<Plugin> {
  const svelteConfig = await loadSvelteConfig();

  return {
    name: 'storybook:svelte-csf',
    resolveId: {
      filter: { id: new RegExp(`^${escapeRegExp(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE)}$`) },
      handler() {
        return svelteCsfRuntimeStoriesPath;
      },
    },
    transform: {
      filter: { id: /\.stories\.svelte$/ },
      handler(compiledCode, id) {
        return transformSvelteCsf({
          filename: id,
          compiledCode,
          compiledAST: this.parse(compiledCode),
          preprocess: svelteConfig?.preprocess,
        });
      },
    },
  };
}
