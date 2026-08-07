/**
 * Worker-target docgen module for `@storybook/angular-vite`.
 *
 * Core's docgen worker imports this module and calls {@link createDocgenProvider} once to build the
 * middleware it folds into the provider chain. Everything here runs inside that worker thread, so
 * the synchronous TypeScript analysis stays off the main event loop and cannot starve the dev
 * server.
 */
import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware, DocgenProvider } from 'storybook/internal/types';

import type { CompodocParsingLogger } from '@storybook/angular-compodoc';
import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { AngularDocgenOptions } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';

/** Worker-side logger, prefixed so a line from a worker thread is attributable. */
const workerLogger: CompodocParsingLogger = {
  warn: (message) => logger.warn(`[storybook-angular-vite] ${message}`),
  debug: (message) => logger.debug(`[storybook-angular-vite] ${message}`),
};

const createManager = async (): Promise<AngularComponentMetaManager | undefined> => {
  try {
    // The project's own compiler, imported at first use: the analyzer must see the TypeScript
    // version the project builds with, and this package deliberately does not ship one.
    const typescript = await import('typescript');
    const manager = new AngularComponentMetaManager(typescript.default ?? typescript);
    manager.startWatching();
    return manager;
  } catch (error) {
    logger.warn(
      `Angular docgen is unavailable: the component meta analyzer could not be created. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
};

/**
 * Builds the Angular docgen middleware. Owns one {@link AngularComponentMetaManager} for the
 * worker's lifetime: one TypeScript language service per matched tsconfig, kept warm across
 * components and kept fresh by the manager's file watching. The manager is created lazily on the
 * first eligible request and memoized; when it cannot be created the middleware passes through to
 * the rest of the chain.
 *
 * Not built on `createLazyDocgenMiddleware`: that util spreads this provider's payload over
 * downstream unconditionally, and an error payload here must not override what another provider
 * produced.
 */
export const createDocgenProvider = (options: AngularDocgenOptions = {}): DocgenMiddleware => {
  let managerPromise: Promise<AngularComponentMetaManager | undefined> | undefined;

  return (nextDocgen: DocgenProvider): DocgenProvider =>
    async (input) => {
      const storyImportPath = getStoryImportPathFromEntry(input.entry);
      if (!storyImportPath || !STORY_FILE_TEST_REGEXP.test(storyImportPath)) {
        return nextDocgen(input);
      }

      const manager = await (managerPromise ??= createManager());
      if (!manager) {
        return nextDocgen(input);
      }

      const ours = buildDocgenPayload(input, { manager, options, logger: workerLogger });
      // The language services hold large type caches; check heap pressure after each extraction
      // since there is no batch surface to hang this on.
      manager.recycleIfHeapPressured();

      // `undefined` uniformly means "no Angular component here": delegate downstream.
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
