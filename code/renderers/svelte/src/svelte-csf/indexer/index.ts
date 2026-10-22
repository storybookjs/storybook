import type { IndexInput, Indexer } from 'storybook/internal/types';

import { parseForIndexer } from './parser.ts';
import { IndexerParseError } from '../utils/error/parser/extract/svelte.ts';
import { isStorybookSvelteCSFError } from '../utils/error.ts';
import { SVELTE_CSF_V5_TAG } from '../constants.ts';
export const createIndexer = (): Indexer => ({
  test: /\.svelte$/,
  createIndex: async (filename, { makeTitle }) => {
    try {
      const { meta, stories } = await parseForIndexer(filename);

      return stories.map((story) => {
        return {
          type: 'story',
          importPath: filename,
          exportName: story.exportName,
          name: story.name,
          title: makeTitle(meta.title),
          tags: [...(meta.tags ?? []), ...(story.tags ?? []), SVELTE_CSF_V5_TAG],
        } satisfies IndexInput;
      });
    } catch (error) {
      // WARN: We can't use `instanceof StorybookSvelteCSFError`, because is an _abstract_ class
      if (isStorybookSvelteCSFError(error)) {
        throw error;
      }

      throw new IndexerParseError(filename, { cause: error });
    }
  },
});
