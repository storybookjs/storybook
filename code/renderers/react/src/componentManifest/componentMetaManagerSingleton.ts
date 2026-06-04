import { logger } from 'storybook/internal/node-logger';

import { ComponentMetaManager } from './componentMeta/ComponentMetaManager.ts';

let componentMetaManagerPromise: Promise<ComponentMetaManager | undefined> | undefined;

/**
 * Process-wide {@link ComponentMetaManager} shared by the experimental manifest generator and the
 * docgen provider so static builds do not construct duplicate TypeScript language services.
 *
 * Both features build full TypeScript programs over every tsconfig project in the workspace. When
 * each owned its own manager, enabling both at once kept two complete sets of programs resident
 * simultaneously and exhausted the heap. Sharing one manager keeps a single set of programs (and
 * one file-snapshot cache) hot for the lifetime of the process.
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
