import { exactRegex } from '@rolldown/pluginutils';
import type { Options as SvelteOptions } from '@sveltejs/vite-plugin-svelte';
import {
  SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
  svelteCsfRuntimeStoriesPath,
  transformSvelteCsf,
} from '@storybook/svelte/internal/svelte-csf/transform';
import type { Plugin } from 'vite';

export function svelteCsf(): Plugin {
  let sveltePlugin: { api?: { options?: SvelteOptions } } | undefined;

  return {
    name: 'storybook:svelte-csf',
    configResolved({ plugins }) {
      // vite-plugin-svelte resolves its options, including every preprocessor it applies, in its own
      // configResolved hook, so read them when transforming
      sveltePlugin = plugins.find(
        (plugin) =>
          plugin.name === 'vite-plugin-svelte:config' || plugin.name === 'vite-plugin-svelte'
      );
    },
    resolveId: {
      // Run before Vite's resolver. When Vite resolves the import itself, its optimizer finds the
      // runtime only while stories load, then pre-bundles it and reloads the page
      order: 'pre',
      filter: { id: exactRegex(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE) },
      handler() {
        return svelteCsfRuntimeStoriesPath;
      },
    },
    transform: {
      filter: { id: /\.stories\.svelte(\?svelte&type=style\b.*)?$/ },
      handler(compiledCode, id) {
        const query = id.indexOf('?');
        if (query !== -1) {
          // vite-plugin-svelte keeps the CSS of a component only while its default export is used. A
          // stories file with `preview.meta()` compiles to stories without a default export, so the
          // production build would drop its CSS. Keep the CSS while the stories file is used.
          const cssScopeTo = [id.slice(0, query), undefined] as const;
          return { code: compiledCode, meta: { vite: { cssScopeTo } } };
        }
        return transformSvelteCsf({
          filename: id,
          compiledCode,
          compiledAST: this.parse(compiledCode),
          preprocess: sveltePlugin?.api?.options?.preprocess,
        });
      },
    },
  };
}
