import { fileURLToPath } from 'node:url';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenProviderDescriptor, StoryDocsProviderPreset } from 'storybook/internal/types';

import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';
import { SVELTE_STORY_FILE_TEST_REGEXP } from './story-file.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (
  nextStoryDocs,
  options
) => {
  const descriptors = await options.presets.apply<DocgenProviderDescriptor[]>(
    'experimental_docgenProvider',
    []
  );
  const svelteWorker = fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER));

  if (!descriptors.some((descriptor) => descriptor.moduleSpecifier === svelteWorker)) {
    return nextStoryDocs;
  }

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !SVELTE_STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const ours = await buildStoryDocsPayload(input);
    if (!ours) {
      return nextStoryDocs(input);
    }

    return { ...(await nextStoryDocs(input)), ...ours };
  };
};
