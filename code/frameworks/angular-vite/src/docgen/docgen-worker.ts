import {
  createLazyDocgenMiddleware,
  extractEach,
  type TypeScriptSpecifierForDocgen,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { DocgenMiddleware } from 'storybook/internal/types';

import type { ParsingLogger } from '@storybook/angular-cm';
import { AngularComponentMetaManager } from '@storybook/angular-cm';
import { loadDocgenTypeScript } from '@storybook/component-meta-typescript';
import type { AngularDocgenOptions } from './build-docgen.ts';
import { buildDocgenPayload } from './build-docgen.ts';

const workerLogger: ParsingLogger = {
  warn: (message) => logger.warn(`[storybook-angular-vite] ${message}`),
  debug: (message) => logger.debug(`[storybook-angular-vite] ${message}`),
};

const createManager = async (
  typeScriptSpecifier: TypeScriptSpecifierForDocgen | undefined
): Promise<AngularComponentMetaManager | undefined> => {
  try {
    // Imported at first use so the analyzer sees the TypeScript version the project builds with,
    // which this package deliberately does not ship.
    const manager = new AngularComponentMetaManager(
      await loadDocgenTypeScript(typeScriptSpecifier)
    );
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
 * Build the Angular docgen middleware, holding one analyzer for the worker's lifetime so its
 * language services stay warm across components.
 */
export const createDocgenProvider = (options: AngularDocgenOptions): DocgenMiddleware =>
  createLazyDocgenMiddleware({
    createManager: () => createManager(options.typeScriptSpecifier),
    extract: (manager, inputs) =>
      extractEach(inputs, async (input) => {
        const ours = buildDocgenPayload(input, { manager, options, logger: workerLogger });
        // A batch can hold every component, so heap pressure is checked after each one.
        manager.recycleIfHeapPressured();
        return ours;
      }),
    // Replacing another provider's payload with our own error would let this link veto the rest of
    // the chain for a component it knows nothing about.
    merge: (own, downstream) => (own.error ? (downstream ?? own) : { ...downstream, ...own }),
  });
