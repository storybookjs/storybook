/**
 * Worker-target docgen module for `@storybook/angular-vite`.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Everything here runs inside that worker thread and
 * only reads Compodoc's `documentation.json` from disk; generating it is not this module's job.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import type { CompodocParsingLogger } from '@storybook/angular-compodoc';
import type { AngularDocgenOptions } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';
import { createDocumentationJsonReader } from './documentation-json.ts';

/** Worker-side logger, prefixed so a line from a worker thread is attributable. */
const workerLogger: CompodocParsingLogger = {
  warn: (message) => logger.warn(`[storybook-angular-vite] ${message}`),
  debug: (message) => logger.debug(`[storybook-angular-vite] ${message}`),
};

/** Builds the Angular docgen middleware. */
export const createDocgenProvider = (options: AngularDocgenOptions): DocgenMiddleware => {
  const readDocumentationJson = createDocumentationJsonReader();

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const ours = buildDocgenPayload(input, {
        options,
        readDocumentationJson,
        logger: workerLogger,
      });

      if (!ours) {
        return nextDocgen(input);
      }
      // Our own extraction failed. Replacing a payload another provider produced with our error
      // would make this link veto the rest of the chain for a component it knows nothing about.
      if (ours.error) {
        return (await nextDocgen(input)) ?? ours;
      }
      return { ...(await nextDocgen(input)), ...ours };
    };
};
