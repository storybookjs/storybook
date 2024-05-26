import fs from 'node:fs';

import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';
import MagicString from 'magic-string';
import { compile, preprocess } from 'svelte/compiler';
import type { Plugin } from 'vite';

import { getNameFromFilename } from '../utils/get-component-name.js';
import { getAST } from '../utils/parser/ast.js';
import { extractStories } from '../utils/parser/extract-stories.js';
import { extractASTNodes } from '../utils/parser/extract-ast-nodes.js';
import { createAppendix } from '../utils/transformer/create-appendix.js';

export async function postTransformPlugin(svelteConfig: SvelteConfig): Promise<Plugin> {
  const { createFilter } = await import('vite');

  const include = /\.stories\.svelte$/;
  const filter = createFilter(include);

  return {
    name: 'storybook:addon-svelte-csf-plugin-post',
    enforce: 'post',
    async transform(code_, id) {
      if (!filter(id)) return undefined;

      let code = new MagicString(code_);

      const componentName = getNameFromFilename(id);

      if (!componentName) {
        // TODO: make error message more user friendly
        // which file, what happened, how to fix
        throw new Error(`Failed to extract component name from filename: ${id}`);
      }

      let source = fs.readFileSync(id).toString();

      if (svelteConfig?.preprocess) {
        const processed = await preprocess(source.toString(), svelteConfig.preprocess, {
          filename: id,
        });

        source = processed.code;
      }

      const { module, fragment } = getAST(source);
      const nodes = await extractASTNodes(module);
      const storiesFileMeta = await extractStories({
        nodes,
        source,
        fragment,
      });

      createAppendix({ componentName, code, storiesFileMeta, nodes });

      return {
        code: code.toString(),
        map: code.generateMap({ hires: true, source: id }),
      };
    },
  };
}
