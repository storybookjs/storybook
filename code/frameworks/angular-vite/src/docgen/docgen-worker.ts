/**
 * Worker-target docgen module for `@storybook/angular-vite`.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Everything here runs inside that worker thread.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import { ensureCompodocDocumentation } from '../compodoc/ensure-documentation.ts';
import type { AngularDocgenOptions } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';
import { createDocumentationJsonReader } from './documentation-json.ts';
import { compodocLogger } from './logger.ts';

/**
 * Builds the Angular docgen middleware, running Compodoc first if `documentation.json` is missing or
 * stale. The run sits in construction rather than per request: core awaits this before arming its
 * per-extract timeout, so a whole-project scan neither counts against that clock nor repeats once
 * per component.
 */
export const createDocgenProvider = async (
  options: AngularDocgenOptions
): Promise<DocgenMiddleware> => {
  await ensureCompodocDocumentation({
    compodocArgs: options.compodocArgs,
    tsconfig: options.tsconfig,
    workspaceRoot: options.workspaceRoot,
    outputDir: options.outputDir,
  });

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
        logger: compodocLogger,
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
