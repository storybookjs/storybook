import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { StoryDocsProviderPreset } from 'storybook/internal/types';

import type { CompodocParsingLogger } from '@storybook/angular-compodoc';
import { resolveCompodocConfig } from '../compodoc-config.ts';
import { buildStoryDocsPayload } from './build-story-docs.ts';
import { createDocumentationJsonReader } from './documentation-json.ts';

const presetLogger: CompodocParsingLogger = {
  warn: (message) => logger.warn(`[storybook-angular-vite] ${message}`),
  debug: (message) => logger.debug(`[storybook-angular-vite] ${message}`),
};

/**
 * Angular story-docs provider: static template snippets for the Source block and the Code panel.
 *
 * Unlike {@link experimental_docgenProvider} this runs in-process on the dev-server main thread,
 * so there is no worker entry and no structured-clone boundary. Bails to `nextStoryDocs` when the
 * entry is not a CSF story file or the file yields nothing; otherwise the payload is merged with
 * downstream via the documented `{ ...downstream, ...ours }` spread, so `stories` is replaced
 * wholesale rather than merged per story.
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

  const context = {
    workspaceRoot: compodoc.workspaceRoot,
    outputDir: compodoc.outputDir,
    readDocumentationJson: createDocumentationJsonReader(),
    logger: presetLogger,
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
