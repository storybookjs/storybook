import { fileURLToPath } from 'node:url';

import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenProviderDescriptor, StoryDocsProviderPreset } from 'storybook/internal/types';

import { DOCGEN_WORKER_SPECIFIER } from '../docgen/worker-specifier.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';

/**
 * Vue renderer story-docs provider, enabled only when Vue's docgen worker is active.
 */
export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (
  nextStoryDocs,
  options
) => {
  const descriptors = await options.presets.apply<DocgenProviderDescriptor[]>(
    'experimental_docgenProvider',
    []
  );
  const vueWorker = fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER));
  const active = descriptors.some((descriptor) => descriptor.moduleSpecifier === vueWorker);

  if (!active) {
    return nextStoryDocs;
  }

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    let ours;
    try {
      ours = await buildStoryDocsPayload(input);
    } catch {
      return nextStoryDocs(input);
    }

    if (!ours) {
      return nextStoryDocs(input);
    }

    const downstream = await nextStoryDocs(input);
    return { ...downstream, ...ours };
  };
};
