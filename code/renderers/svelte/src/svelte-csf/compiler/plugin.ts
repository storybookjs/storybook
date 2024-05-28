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

import { createAppendix } from './transform/compiled/create-appendix.js';
import { insertDefineMetaJSDocCommentAsDescription } from './transform/define-meta/description.js';
import { destructureMetaFromDefineMeta } from './transform/define-meta/destructure-meta.js';
import { insertStoryHTMLCommentAsDescription } from './transform/Story/description.js';
import { getNameFromFilename } from '../utils/get-component-name.js';
import { getSvelteAST } from '../utils/parser/ast.js';
import { extractStories } from '../utils/parser/extract-stories.js';
import { extractStoriesNodesFromExportDefaultFn } from '../utils/parser/extract/compiled/stories.js';
import { extractCompiledASTNodes } from '../utils/parser/extract/compiled/nodes.js';
import { extractSvelteASTNodes } from '../utils/parser/extract/svelte/nodes.js';

export async function plugin(): Promise<Plugin> {
  const [{ createFilter }, { loadSvelteConfig }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);

  const svelteConfig = await loadSvelteConfig();
  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin-post',
    enforce: 'post',
    async transform(code_, filename) {
      if (!filter(filename)) return undefined;

      const compiledAST = this.parse(code_);
      let code = new MagicString(code_);

      const componentName = getNameFromFilename(filename);

      if (!componentName) {
        // TODO: make error message more user friendly
        // what happened, how to fix
        throw new Error(`Failed to extract component name from filename: ${filename}`);
      }

      let source = fs.readFileSync(filename).toString();

      if (svelteConfig?.preprocess) {
        const processed = await preprocess(source.toString(), svelteConfig.preprocess, {
          filename: filename,
        });

        source = processed.code;
      }

      const svelteAST = getSvelteAST({ source, filename });
      const svelteNodes = await extractSvelteASTNodes({
        ast: svelteAST,
        filename,
      });
      const compiledNodes = await extractCompiledASTNodes({
        ast: compiledAST,
        filename,
      });
      const storiesFileMeta = await extractStories({
        ast: svelteAST,
        nodes: svelteNodes,
        source,
        filename,
      });
      const extractedCompiledStoriesNodes = await extractStoriesNodesFromExportDefaultFn({
        nodes: compiledNodes,
        filename,
      });

      // WARN:
      // IMPORTANT! The plugins starts updating the compiled ouput code from the bottom.
      // Why? Because once we start updating nodes in the stringified output from the top,
      // then other nodes `start` and `end` numbers will not be correct anymore.
      // Hence the reason why reversing both arrays with stories _(svelte and compiled)_.
      const svelteStories = svelteNodes.storyComponents.toReversed();
      const compiledStories = extractedCompiledStoriesNodes.toReversed();

      for (const [index, compiled] of Object.entries(compiledStories)) {
        insertStoryHTMLCommentAsDescription({
          code,
          nodes: { svelte: svelteStories[index], compiled },
          filename,
        });
      }
      await destructureMetaFromDefineMeta({
        code,
        nodes: compiledNodes,
        filename,
      });
      insertDefineMetaJSDocCommentAsDescription({
        code,
        nodes: {
          compiled: compiledNodes,
          svelte: svelteNodes,
        },
        filename,
      });
      createAppendix({
        componentName,
        code,
        storiesFileMeta,
        nodes: svelteNodes,
        filename,
      });

      return {
        code: code.toString(),
        map: code.generateMap({ hires: true, source: filename }),
      };
    },
  };
}
