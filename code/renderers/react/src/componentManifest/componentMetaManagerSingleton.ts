import { getInstanceContext } from '@storybook/core/internal/instance';
import { logger } from '@storybook/core/internal/node-logger';

import { ComponentMetaManager } from './componentMeta/ComponentMetaManager.ts';

const COMPONENT_META_MANAGER = Symbol.for('storybook.react.component-meta-manager');

/**
 * The running instance's {@link ComponentMetaManager} for the experimental manifest generator, or
 * `undefined` outside an instance. Building a TypeScript program over every tsconfig project is
 * expensive, so each instance keeps one set of programs (and one file-snapshot cache) hot across
 * manifest builds and disposes it when the instance closes.
 *
 * `docgenServer` deliberately does NOT share this manager: its extraction runs in a worker thread
 * ({@link ../docgen/docgen-worker.ts}) with its own manager so the synchronous program build stays
 * off the main event loop. Enabling both keeps two full program sets resident at once.
 */
export function getInstanceComponentMetaManager():
  | Promise<ComponentMetaManager | undefined>
  | undefined {
  const context = getInstanceContext();
  if (!context) {
    return undefined;
  }
  if (!context.state.has(COMPONENT_META_MANAGER)) {
    const manager = createComponentMetaManager();
    context.state.set(COMPONENT_META_MANAGER, manager);
    context.cleanups.add(async () => {
      context.state.delete(COMPONENT_META_MANAGER);
      (await manager)?.dispose();
    });
  }
  return context.state.get(COMPONENT_META_MANAGER) as Promise<ComponentMetaManager | undefined>;
}

/** Creates a manager the caller owns and disposes, or `undefined` without TypeScript. */
export async function createComponentMetaManager(): Promise<ComponentMetaManager | undefined> {
  try {
    const ts = await import('typescript');
    return new ComponentMetaManager(ts.default ?? ts);
  } catch (err) {
    logger.debug(`[reactComponentMeta] Skipping component metadata extraction: ${err}`);
    return undefined;
  }
}
