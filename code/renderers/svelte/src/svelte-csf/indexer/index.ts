import type { Indexer } from '@storybook/types';
import { preprocess } from 'svelte/compiler';
import fs from 'node:fs/promises';

import { getAST } from '../utils/parser/ast.js';
import { extractStories } from '../utils/parser/extract-stories.js';
import { extractASTNodes } from '../utils/parser/extract-ast-nodes.js';

export const indexer: Indexer = {
  test: /\.svelte$/,
  createIndex: async (fileName, { makeTitle }) => {
    let [source, { loadSvelteConfig }] = await Promise.all([
      fs.readFile(fileName, { encoding: 'utf8' }),
      import('@sveltejs/vite-plugin-svelte'),
    ]);

    const svelteOptions = await loadSvelteConfig();
    if (svelteOptions?.preprocess) {
      source = (
        await preprocess(source, svelteOptions.preprocess, {
          filename: fileName,
        })
      ).code;
    }

    const { module, fragment } = getAST(source);
    const nodes = await extractASTNodes(module);

    const { defineMeta, stories } = await extractStories({ nodes, fragment, source });

    return Object.entries(stories).map(([storyId, storyMeta]) => ({
      type: 'story',
      importPath: fileName,
      exportName: storyId,
      name: storyMeta.name,
      title: makeTitle(defineMeta.title),
      // TODO: include tags from stories, not just from defineMeta
      tags: defineMeta.tags,
      // TODO: add metaId if defineMeta has custom id
    }));
  },
};
