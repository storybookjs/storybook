import fs from 'node:fs';

import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';
import MagicString from 'magic-string';
import { createFilter, type Plugin } from 'vite';

import { extractStories } from '../../parser/extract-stories.js';
import { transformDefineMeta } from '../../transformer/define-meta.js';
import { preprocess } from 'svelte/compiler';

export default function plugin(svelteOptions: SvelteConfig): Plugin {
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin-pre',
    enforce: 'pre',
    async transform(code_, id) {
      if (!filter(id)) return undefined;

      let source = fs.readFileSync(id).toString();

      // FIXME: Do we have to do it twice?
      if (svelteOptions && svelteOptions.preprocess) {
        const processed = await preprocess(source.toString(), svelteOptions.preprocess, {
          filename: id,
        });

        source = processed.code;
      }
      const storiesFileMeta = extractStories(source);
      const code = new MagicString(code_);

      transformDefineMeta({ code, storiesFileMeta });

      return {
        code: code.toString(),
        map: code.generateMap({ hires: true, source: id }),
      };
    },
  };
}
