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

import { codemodLegacyNodes } from './pre-transform/index.ts';
import { transformStoriesCode } from './post-transform/index.ts';
import { getSvelteAST } from '../parser/ast.ts';
import { extractCompiledASTNodes } from '../parser/extract/compiled/nodes.ts';
import { extractSvelteASTNodes } from '../parser/extract/svelte/nodes.ts';
import { SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE } from '../constants.ts';

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

        // NOTE: Printing the AST again collapses the whitespace between nodes,
        // which would also remove the newlines from the stories' source code snippets.
        // So only print it when a codemod changed something.
        if (transformedSvelteAST === svelteAST) {
          return {
            code,
            map: null,
            meta: {
              _storybook_csf_pre_transform: code,
            },
          };
        }

        const magicCode = new MagicString(code);

        magicCode.overwrite(0, code.length, print(transformedSvelteAST));

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
          include: [SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE],
        },
      };
    },
    async transform(compiledCode, id) {
      if (!filter(id)) return undefined;

      const compiledAST = this.parse(compiledCode);
      const magicCompiledCode = new MagicString(compiledCode);
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
