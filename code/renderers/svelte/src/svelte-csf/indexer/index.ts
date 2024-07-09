import { combineTags } from '@storybook/csf';
import type { IndexInput, Indexer } from '@storybook/types';

import { parseForIndexer } from '#indexer/parser';

export const indexer: Indexer = {
  test: /\.svelte$/,
  createIndex: async (filename, { makeTitle }) => {
    const { meta, stories } = await parseForIndexer(
      filename,
      // TODO: @JReinhold Replace with dynamic pass of options
      {
        supportLegacy: false,
      }
    );

    return stories.map((story) => {
      return {
        type: 'story',
        importPath: filename,
        exportName: story.exportName,
        name: story.name,
        title: makeTitle(meta.title),
        tags: combineTags(...(meta.tags ?? []), ...(story.tags ?? [])),
      } satisfies IndexInput;
    });
  },
};
