import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import { join } from 'node:path';

import { DOCUMENTATION_JSON, resolveCompodocConfig } from '../compodoc-config.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import { createCompodocComponentResolver } from './compodoc-component-resolver.ts';
import { createDocumentationJsonReader } from './documentation-json.ts';
import { compodocLogger } from './logger.ts';

/**
 * Angular story-docs provider: static template snippets for the Source block and the Code panel.
 * Runs in-process on the dev-server main thread, so unlike the docgen provider there is no worker
 * entry and no structured-clone boundary.
 */
export const experimental_storyDocsProvider: StoryDocsProviderPreset = async (
  nextStoryDocs,
  options
) => {
  const compodoc = await resolveCompodocConfig(options);

  // Opting out of Compodoc removes the only source of a component's selector and binding names, so
  // there is nothing left for this provider to generate from.
  if (!compodoc.enabled) {
    return nextStoryDocs;
  }

  const readDocumentationJson = createDocumentationJsonReader();
  const documentationJson = join(compodoc.outputDir, DOCUMENTATION_JSON);

  const context = {
    storyRoot: process.cwd(),
    resolveComponent: createCompodocComponentResolver({
      workspaceRoot: compodoc.workspaceRoot,
      readMetadata: () => readDocumentationJson(documentationJson),
      logger: compodocLogger,
    }),
    logger: compodocLogger,
  };

  return async (input) => {
    const storyImportPath = getStoryImportPathFromEntry(input.entry);
    if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
      return nextStoryDocs(input);
    }

    const ours = buildStoryDocsPayload(input, context);
    if (!ours) {
      return nextStoryDocs(input);
    }

    return { ...(await nextStoryDocs(input)), ...ours };
  };
};
