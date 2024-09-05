import fs from 'node:fs/promises';

import type { IndexInput, Indexer } from '@storybook/types';

import { parseForIndexer } from '#indexer/parser';
import {
  GetDefineMetaFirstArgumentError,
  IndexerParseError,
  MissingModuleTagError,
  NoStoryComponentDestructuredError,
} from '#utils/error/parser/extract/svelte';
import { LegacyTemplateNotEnabledError } from '#utils/error/codemod/index';
import { NoDestructuredDefineMetaCallError } from '#utils/error/parser/analyse/define-meta';

export const createIndexer = (legacyTemplate: boolean): Indexer => ({
  test: /\.svelte$/,
  createIndex: async (filename, { makeTitle }) => {
    try {
      const { meta, stories } = await parseForIndexer(filename, { legacyTemplate });

      return stories.map((story) => {
        return {
          type: 'story',
          importPath: filename,
          exportName: story.exportName,
          name: story.name,
          title: makeTitle(meta.title),
          tags: [...(meta.tags ?? []), ...(story.tags ?? [])],
        } satisfies IndexInput;
      });
    } catch (error) {
      if (
        // NOTE: Those errors are hand-picked from what might be thrown in `./parser.ts`
        // and are related to using legacy API.
        error instanceof MissingModuleTagError ||
        error instanceof NoDestructuredDefineMetaCallError ||
        error instanceof NoStoryComponentDestructuredError ||
        error instanceof GetDefineMetaFirstArgumentError
      ) {
        const { filename } = error;
        throw new LegacyTemplateNotEnabledError(filename);
      }

      throw new IndexerParseError();
    }
  },
});
