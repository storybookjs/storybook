/**
 * NOTE:
 *
 * 1. Why Svelte AST nodes had to be included?
 *    - During the compilation from Svelte to JS, HTML comments are removed.
 *    - Rollup' internal `this.parse()` excludes `leadingComments` from parsing.
 *      I couldn't find an option to override this behavior.
 *      I wanted to avoid adding another package for parsing _(getting AST)_ - e.g. `acorn`
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import MagicString from 'magic-string';
import { preprocess } from 'svelte/compiler';
import type { Plugin } from 'vite';

import { transformStoriesCode } from './post-transform/index.ts';
import { getSvelteAST } from '../parser/ast.ts';
import { extractCompiledASTNodes } from '../parser/extract/compiled/nodes.ts';
import { extractSvelteASTNodes } from '../parser/extract/svelte/nodes.ts';
import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../constants.ts';

export async function transformPlugin(): Promise<Plugin> {
  const [{ createFilter }, { loadSvelteConfig }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);

  const svelteConfig = await loadSvelteConfig();
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);
  // Users don't depend on @storybook/svelte directly, so a strict package manager like pnpm can't
  // resolve this import from their stories files. It resolves from here.
  const runtimeStoriesPath = fileURLToPath(
    import.meta.resolve(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE)
  );

  return {
    name: 'storybook:svelte-csf',
    config() {
      return {
        optimizeDeps: {
          include: [runtimeStoriesPath],
        },
      };
    },
    resolveId(source) {
      if (source === SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE) {
        return runtimeStoriesPath;
      }
    },
    async transform(compiledCode, id) {
      if (!filter(id)) return undefined;

      const compiledAST = this.parse(compiledCode);
      const magicCompiledCode = new MagicString(compiledCode);
      let rawCode = fs.readFileSync(id).toString();

      if (svelteConfig?.preprocess) {
        const processed = await preprocess(rawCode, svelteConfig.preprocess, {
          filename: id,
        });
        rawCode = processed.code;
      }

      const svelteAST = getSvelteAST({ code: rawCode, filename: id });
      const svelteASTNodes = await extractSvelteASTNodes({
        ast: svelteAST,
        filename: id,
      });
      const compiledASTNodes = await extractCompiledASTNodes({
        ast: compiledAST,
        filename: id,
      });

      await transformStoriesCode({
        code: magicCompiledCode,
        nodes: {
          svelte: svelteASTNodes,
          compiled: compiledASTNodes,
        },
        filename: id,
        originalCode: rawCode,
      });

      return {
        code: magicCompiledCode.toString(),
        map: magicCompiledCode.generateMap({ hires: true, source: id }),
      };
    },
  };
}
