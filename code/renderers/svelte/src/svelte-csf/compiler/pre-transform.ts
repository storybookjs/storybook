// TODO: Remove this plugin, and use AST on post transform.

import MagicString from 'magic-string';
import type { Plugin } from 'vite';

import { extractSvelteASTNodes } from '../utils/parser/extract-ast-nodes.js';
import { getSvelteAST } from '../utils/parser/ast.js';
import { transformDefineMeta } from '../utils/transformer/define-meta.js';

export async function preTransformPlugin(): Promise<Plugin> {
  const { createFilter } = await import('vite');

  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin-pre',
    enforce: 'pre',
    async transform(code_, filename) {
      if (!filter(filename)) return;

      const svelteAst = getSvelteAST({ source: code_, filename });
      const nodes = await extractSvelteASTNodes({ ast: svelteAst, filename });
      const code = new MagicString(code_);

      transformDefineMeta({ code, nodes, filename });

      return {
        code: code.toString(),
        map: code.generateMap({ hires: true, source: filename }),
      };
    },
  };
}
