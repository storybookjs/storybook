import type { StorybookConfig } from '@storybook/svelte-vite';
import type { IndexInput, IndexerOptions } from '@storybook/types';

import { vite } from './presets/vite.js';
import { webpack } from './presets/webpack.js';
import { readStories } from './presets/indexer.js';

export const viteFinal = vite;
export const webpackFinal = webpack;

/**
 * Storybook >= 7.4
 */
export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [
    {
      test: /\.svelte$/,
      createIndex,
    },
    ...(indexers || []),
  ];
};

/**
 * Indexer for Storybook >= 7.4
 */
async function createIndex(fileName: string, { makeTitle }: IndexerOptions): Promise<IndexInput[]> {
  const storiesFileMeta = await readStories(fileName);
  const { fragment, module } = storiesFileMeta;
  const { stories } = fragment;

  return Object.entries(stories).map(([storyId, storyMeta]) => {
    return {
      type: 'story',
      importPath: fileName,
      exportName: storyId,
      name: storyMeta.name,
      title: makeTitle(module.title),
      tags: module.tags,
      metaTags: module.tags,
    };
  });
}
