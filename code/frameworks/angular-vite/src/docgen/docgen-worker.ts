/**
 * Worker-target docgen module for the Angular renderer.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Angular's docgen runs in-line inside the worker
 * (unlike React's, it needs no long-lived TypeScript program to stay warm) — it only reads the
 * story file and the project's Compodoc `documentation.json`, both cached by mtime.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import { buildDocgenPayload } from './buildDocgen.ts';

export const createDocgenProvider = (): DocgenMiddleware => {
  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const ours = await buildDocgenPayload(input);
      if (!ours) {
        return nextDocgen(input);
      }

      const downstream = await nextDocgen(input);
      return { ...downstream, ...ours };
    };
};
