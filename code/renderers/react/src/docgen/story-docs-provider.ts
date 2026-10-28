import {
  STORY_FILE_TEST_REGEXP,
  getStoryImportPathFromEntry,
} from '@storybook/core/internal/common';
import type { StoryDocsProvider } from '@storybook/core/internal/types';

import type { TypescriptOptions } from '../componentManifest/getComponentImports.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';

/**
 * Wrap `nextStoryDocs` with the React provider, reading TypeScript options once. Non-CSF entries and
 * failed extractions fall through; otherwise our payload wins per top-level key over downstream.
 */
export function createStoryDocsProvider(
  nextStoryDocs: StoryDocsProvider,
  typescriptOptionsPromise: Promise<Partial<TypescriptOptions>>
): StoryDocsProvider {
  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const ours = await buildStoryDocsPayload(input, {
      typescriptOptions: await typescriptOptionsPromise,
    });
    if (!ours) {
      return nextStoryDocs(input);
    }

    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
}
