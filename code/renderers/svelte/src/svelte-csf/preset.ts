import fs from 'node:fs/promises';

import type { StorybookConfig } from '@storybook/svelte-vite';
import type { IndexInput, IndexerOptions } from '@storybook/types';
import { preprocess } from 'svelte/compiler';

import type { StoriesFileMeta } from './parser/types.js';
import { getAST } from './parser/ast.js';
import { extractStories } from './parser/extract-stories.js';
import { extractASTNodes } from './parser/extract-ast-nodes.js';
import { loadSvelteConfig } from './presets/svelte/config-loader.js';

export { viteFinal } from './presets/vite.js';
export { webpackFinal } from './presets/webpack.js';

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [
    {
      test: /\.svelte$/,
      createIndex,
    },
    ...(indexers || []),
  ];
};

async function createIndex(fileName: string, { makeTitle }: IndexerOptions): Promise<IndexInput[]> {
  const storiesFileMeta = await readStories(fileName);
  const { defineMeta, stories } = storiesFileMeta;

  return Object.entries(stories).map(([storyId, storyMeta]) => {
    return {
      type: 'story',
      importPath: fileName,
      exportName: storyId,
      name: storyMeta.name,
      title: makeTitle(defineMeta.title),
      tags: defineMeta.tags,
    } satisfies IndexInput;
  });
}

export async function readStories(fileName: string): Promise<StoriesFileMeta> {
  let source = (await fs.readFile(fileName, { encoding: 'utf8' })).toString();

  const svelteOptions = await loadSvelteConfig();

  if (svelteOptions && svelteOptions.preprocess) {
    source = (
      await preprocess(source, svelteOptions.preprocess, {
        filename: fileName,
      })
    ).code;
  }

  const { module, fragment } = getAST(source);
  const nodes = extractASTNodes(module);

  return extractStories({ nodes, fragment, source });
}
