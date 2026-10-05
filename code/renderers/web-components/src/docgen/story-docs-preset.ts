import { fileURLToPath } from 'node:url';

import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { getService } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenProviderDescriptor, StoryDocsProviderPreset } from 'storybook/internal/types';

import type { WebComponentsDocgenPayload } from './component-docgen/build-docgen.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';
import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';

let warnedMissingDocgenService = false;

const getDocgenPayload = async (
  componentId: string
): Promise<WebComponentsDocgenPayload | undefined> => {
  try {
    const docgenService = getService('core/docgen', { internal: true });
    return await docgenService.queries.docgen.loaded({ id: componentId });
  } catch (error) {
    if (!warnedMissingDocgenService) {
      warnedMissingDocgenService = true;
      logger.warn(
        `Web Components story snippets are unavailable: querying core/docgen failed. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return undefined;
  }
};

export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (
  nextStoryDocs,
  options
) => {
  const descriptors = await options.presets.apply<DocgenProviderDescriptor[]>(
    'experimental_docgenProvider',
    []
  );
  const worker = fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER));
  const active = descriptors.some((descriptor) => descriptor.moduleSpecifier === worker);

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
      ours = await buildStoryDocsPayload(input, { getDocgenPayload });
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
