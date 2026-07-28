/**
 * Worker-target docgen module for the Vue 3 Vite framework.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Everything here runs inside that worker thread, so the
 * synchronous `vue-component-meta` (Volar) type checking stays off the main event loop and cannot
 * starve the Vite dev server.
 *
 * The engine lives in the framework rather than the renderer because `vue-component-meta` is the
 * framework's docgen choice (`framework.options.docgen`); the renderer only owns the argTypes
 * conversion, which this module imports from `@storybook/vue3`.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import type { ComponentMetaChecker } from 'vue-component-meta';

import { buildDocgenPayload } from './build-docgen.ts';
import { CheckerFreshness } from './checker-freshness.ts';
import { createVueComponentMetaChecker } from './component-meta.ts';

/** Tsconfig the checker should use, forwarded from `framework.options.docgen.tsconfig`. */
export interface CreateDocgenProviderOptions {
  tsconfigPath?: string;
}

export const createDocgenProvider = (
  options: CreateDocgenProviderOptions = {}
): DocgenMiddleware => {
  let checkerPromise: Promise<
    { checker: ComponentMetaChecker; freshness: CheckerFreshness } | undefined
  >;

  const getChecker = () => {
    checkerPromise ??= (async () => {
      try {
        const checker = await createVueComponentMetaChecker(options.tsconfigPath);
        return { checker, freshness: new CheckerFreshness(checker) };
      } catch (error) {
        logger.warn(
          `Vue docgen is unavailable: the vue-component-meta checker could not be created. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return undefined;
      }
    })();
    return checkerPromise;
  };

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const active = await getChecker();
      if (!active) {
        return nextDocgen(input);
      }

      active.freshness.sweep();

      const ours = await buildDocgenPayload(input, { checker: active.checker });
      if (!ours) {
        return nextDocgen(input);
      }

      const downstream = await nextDocgen(input);
      return { ...downstream, ...ours };
    };
};
