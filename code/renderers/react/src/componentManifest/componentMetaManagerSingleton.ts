import { logger } from 'storybook/internal/node-logger';

import { ComponentMetaManager } from './componentMeta/ComponentMetaManager.ts';

let componentMetaManagerPromise: Promise<ComponentMetaManager | undefined> | undefined;

/**
 * Process-wide {@link ComponentMetaManager} for the experimental manifest generator: building a full
 * TypeScript program over every tsconfig project in the workspace is expensive, so the manifest
 * generator keeps a single set of programs (and one file-snapshot cache) hot for the lifetime of the
 * process rather than rebuilding per request.
 *
 * `experimentalDocgenServer` deliberately does NOT share this manager: its extraction runs in a
 * worker thread ({@link ../docgen/docgen-worker.ts}) with its own manager so the synchronous program
 * build stays off the main event loop. Worker threads have separate V8 heaps but share process RSS,
 * so enabling both the manifest generator and the docgen server keeps two full program sets resident
 * at once — acceptable today, but the reason this singleton is scoped to the manifest path only.
 */
export function getSharedComponentMetaManager(): Promise<ComponentMetaManager | undefined> {
  if (!componentMetaManagerPromise) {
    componentMetaManagerPromise = (async () => {
      try {
        const ts = await import('typescript');
        return new ComponentMetaManager(ts);
      } catch {
        logger.debug(
          '[reactComponentMeta] TypeScript not available, skipping component meta extraction.'
        );
        return undefined;
      }
    })();
  }
  return componentMetaManagerPromise;
}

export function disposeSharedComponentMetaManager(): void {
  void componentMetaManagerPromise?.then((manager) => manager?.dispose());
  componentMetaManagerPromise = undefined;
}
