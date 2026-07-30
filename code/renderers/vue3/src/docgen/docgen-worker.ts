/**
 * Worker-target docgen module for the Vue 3 renderer.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Everything here runs inside that worker thread, so
 * the synchronous `vue-component-meta` (Volar) type checking stays off the main event loop and
 * cannot starve the dev server.
 *
 * The framework contributes the descriptor that points here; nothing in this module is bundler
 * specific, so it sits with the rest of the Vue docgen code in the renderer.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import { buildDocgenPayload } from './build-docgen.ts';
import { VueComponentMetaManager } from './vue-project-manager.ts';

/**
 * Builds the Vue docgen middleware. Owns one {@link VueComponentMetaManager} for the worker's
 * lifetime: one `vue-component-meta` checker per matched tsconfig, kept warm across components and
 * kept fresh by the manager's file watching plus a targeted mtime check at extraction time. The
 * manager is created lazily on the first eligible request and memoized; when it cannot be created
 * the middleware passes through to the rest of the chain.
 */
export const createDocgenProvider = (): DocgenMiddleware => {
  let managerPromise: Promise<VueComponentMetaManager | undefined>;

  const getManager = () => {
    managerPromise ??= (async () => {
      try {
        const typescript = await import('typescript');
        const manager = new VueComponentMetaManager(typescript.default ?? typescript);
        manager.startWatching();
        return manager;
      } catch (error) {
        logger.warn(
          `Vue docgen is unavailable: the vue-component-meta project manager could not be created. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return undefined;
      }
    })();
    return managerPromise;
  };

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const manager = await getManager();
      if (!manager) {
        return nextDocgen(input);
      }

      const ours = await buildDocgenPayload(input, {
        getChecker: (componentPath) => manager.getCheckerForFile(componentPath),
      });
      // Volar programs hold large type caches; check heap pressure after each extraction since Vue
      // has no batch surface to hang this on.
      manager.recycleIfHeapPressured();
      if (!ours) {
        return nextDocgen(input);
      }

      const downstream = await nextDocgen(input);
      return { ...downstream, ...ours };
    };
};
