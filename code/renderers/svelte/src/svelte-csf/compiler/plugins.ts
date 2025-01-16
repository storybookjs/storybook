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

import MagicString from 'magic-string';
import { preprocess } from 'svelte/compiler';
import type { Plugin } from 'vite';

import { codemodLegacyNodes } from '$lib/compiler/pre-transform/index.js';
import { transformStoriesCode } from '$lib/compiler/post-transform/index.js';
import { getSvelteAST } from '$lib/parser/ast.js';
import { extractCompiledASTNodes } from '$lib/parser/extract/compiled/nodes.js';
import { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';

export async function preTransformPlugin(): Promise<Plugin> {
  const [{ createFilter }, { print }] = await Promise.all([
    import('vite'),
    import('svelte-ast-print'),
  ]);
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-legacy-api-support',
    enforce: 'pre',
    transform: {
      order: 'pre',
      async handler(code, id) {
        if (!filter(id)) return undefined;

        const svelteAST = getSvelteAST({ code, filename: id });
        const transformedSvelteAST = await codemodLegacyNodes({
          ast: svelteAST,
          filename: id,
        });

        let magicCode = new MagicString(code);

        magicCode.overwrite(0, code.length - 1, print(transformedSvelteAST));

        const stringifiedMagicCode = magicCode.toString();

        return {
          code: stringifiedMagicCode,
          map: magicCode.generateMap({ hires: true, source: id }),
          meta: {
            _storybook_csf_pre_transform: stringifiedMagicCode,
          },
        };
      },
    },
  };
}

export async function transformPlugin(): Promise<Plugin> {
  const [{ createFilter }, { loadSvelteConfig }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);

  const svelteConfig = await loadSvelteConfig();
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf',
    config() {
      return {
        optimizeDeps: {
          include: ['@storybook/addon-svelte-csf/internal/create-runtime-stories'],
        },
      };
    },
    async transform(compiledCode, id) {
      if (!filter(id)) return undefined;

      const compiledAST = this.parse(compiledCode);
      let magicCompiledCode = new MagicString(compiledCode);
      let rawCode =
        (this.getModuleInfo(id)?.meta._storybook_csf_pre_transform as string | undefined) ??
        fs.readFileSync(id).toString();

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
