import { STORY_FILE_TEST_REGEXP, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type {
  DocgenComponentMetaQuery,
  DocgenMiddleware,
  DocgenProvider,
} from 'storybook/internal/types';

import type { AngularComponentMetaResult, ParsingLogger } from '@storybook/angular-cm';
import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { AngularDocgenOptions } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';

const workerLogger: ParsingLogger = {
  warn: (message) => logger.warn(`[storybook-angular-vite] ${message}`),
  debug: (message) => logger.debug(`[storybook-angular-vite] ${message}`),
};

const createManager = async (): Promise<AngularComponentMetaManager | undefined> => {
  try {
    // Imported at first use so the analyzer sees the TypeScript version the project builds with,
    // which this package deliberately does not ship.
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

// Module-scoped (not per-`createDocgenProvider`-call) so `queryComponentMeta` shares the same
// warm analyzer instead of each getting its own. Node evaluates this module once per worker
// thread, and the worker imports it once, so this is the one owner for the worker's lifetime.
let managerPromise: Promise<AngularComponentMetaManager | undefined> | undefined;

const getManager = (): Promise<AngularComponentMetaManager | undefined> =>
  (managerPromise ??= createManager());

/**
 * Build the Angular docgen middleware, holding one analyzer for the worker's lifetime so its
 * language services stay warm across components.
 */
export const createDocgenProvider = (options: AngularDocgenOptions = {}): DocgenMiddleware => {
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

      const ours = buildDocgenPayload(input, { manager, options, logger: workerLogger });
      // There is no batch surface to hang this on, so heap pressure is checked once per extraction.
      manager.recycleIfHeapPressured();

      if (!ours) {
        return nextDocgen(input);
      }
      // Replacing another provider's payload with our own error would let this link veto the rest
      // of the chain for a component it knows nothing about.
      if (ours.error) {
        return (await nextDocgen(input)) ?? ours;
      }
      return { ...(await nextDocgen(input)), ...ours };
    };
};

/**
 * Resolve one component's raw analyzer metadata for `core/story-docs`, which needs fields no
 * `DocgenPayload` carries (a selector, the file's resolved enum table) to build a snippet. Shares
 * `getManager()` with {@link createDocgenProvider} rather than owning a second analyzer.
 */
export const queryComponentMeta = async (
  query: DocgenComponentMetaQuery
): Promise<AngularComponentMetaResult | undefined> => {
  const manager = await getManager();
  if (!manager) {
    return undefined;
  }
  try {
    return manager.extractComponentMeta(query.componentPath, {
      exportName: query.exportName,
      localName: query.localName,
    });
  } finally {
    // Same reasoning as `createDocgenProvider`: no batch surface, so check once per query.
    manager.recycleIfHeapPressured();
  }
};
