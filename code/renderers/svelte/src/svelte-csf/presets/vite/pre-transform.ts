import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';
import MagicString from 'magic-string';
import { createFilter, type Plugin } from 'vite';

import { extractASTNodes } from '../../parser/extract-ast-nodes.js';
import { getAST } from '../../parser/ast.js';
import { transformDefineMeta } from '../../transformer/define-meta.js';

export default function plugin(_svelteOptions: SvelteConfig): Plugin {
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin-pre',
    enforce: 'pre',
    async transform(code_, id) {
      if (!filter(id)) return;

      const { module } = getAST(code_);
      const nodes = extractASTNodes(module);
      const code = new MagicString(code_);

      transformDefineMeta({ code, nodes });

      return {
        code: code.toString(),
        map: code.generateMap({ hires: true, source: id }),
      };
    },
  };
}
