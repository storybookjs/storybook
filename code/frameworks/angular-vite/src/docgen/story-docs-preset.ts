import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import type { AngularComponentMetaResult } from '@storybook/angular-cm';
import type { AngularComponentMetaQuerySource } from './story-docs-build.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';

export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (
  nextStoryDocs,
  options
) => {
  const docgenWorker = options.docgenWorker;
  // Proxies component-meta lookups to the analyzer the docgen worker already warmed and watches,
  // rather than constructing a second `AngularComponentMetaManager` here. `undefined` when the
  // worker itself is unavailable (e.g. running from source without a build); descriptions still
  // extract without it.
  const manager: AngularComponentMetaQuerySource | undefined = docgenWorker && {
    extractComponentMeta: async (componentPath, names) => {
      try {
        return (await docgenWorker.query({
          componentPath,
          exportName: names.exportName,
          localName: names.localName,
        })) as AngularComponentMetaResult | undefined;
      } catch (error) {
        logger.warn(
          `Angular story snippets are unavailable for ${componentPath}: the docgen worker query failed. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return undefined;
      }
    },
  };

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const ours = await buildStoryDocsPayload(input, { manager });

    if (!ours) {
      return nextStoryDocs(input);
    }
    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
};
