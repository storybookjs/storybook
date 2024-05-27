import fs from 'node:fs';

import MagicString from 'magic-string';
import { preprocess } from 'svelte/compiler';
import type { Plugin } from 'vite';

import { getNameFromFilename } from '../utils/get-component-name.js';
import { getSvelteAST } from '../utils/parser/ast.js';
import { extractStories } from '../utils/parser/extract-stories.js';
import { extractSvelteASTNodes } from '../utils/parser/extract-ast-nodes.js';
import { createAppendix } from '../utils/transformer/create-appendix.js';

export async function postTransformPlugin(): Promise<Plugin> {
  const [{ createFilter }, { loadSvelteConfig }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  let svelteConfig = await loadSvelteConfig();

  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin-post',
    enforce: 'post',
    async transform(code_, filename) {
      if (!filter(filename)) return undefined;

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
      const nodes = await extractSvelteASTNodes({ ast: svelteAST, filename });
      const storiesFileMeta = await extractStories({
        ast: svelteAST,
        nodes,
        source,
        filename,
      });

      createAppendix({ componentName, code, storiesFileMeta, nodes, filename });

      return {
        code: code.toString(),
        map: code.generateMap({ hires: true, source: filename }),
      };
    },
  };
}
