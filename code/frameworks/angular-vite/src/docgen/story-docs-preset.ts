import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { getService } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import type { AngularDocgenPayload } from './build-docgen.ts';
import { buildStoryDocsPayload } from './story-docs-build.ts';

// `core/docgen` is only registered when `experimentalDocgenServer` set up its worker (see
// `common-preset.ts`); both services are gated by the same feature, but registration order isn't
// a type-level guarantee, so this stays defensive rather than asserting the service exists.
let warnedMissingDocgenService = false;

const getDocgenPayload = async (componentId: string): Promise<AngularDocgenPayload | undefined> => {
  try {
    const docgenService = getService('core/docgen', { internal: true });
    return await docgenService.queries.docgen.loaded({ id: componentId });
  } catch (error) {
    if (!warnedMissingDocgenService) {
      warnedMissingDocgenService = true;
      logger.warn(
        `Angular story snippets are unavailable: querying core/docgen failed. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return undefined;
  }
};

export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (nextStoryDocs) => {
  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const ours = await buildStoryDocsPayload(input, { getDocgenPayload });

    if (!ours) {
      return nextStoryDocs(input);
    }
    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
};
