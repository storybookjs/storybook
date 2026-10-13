import { logger } from 'storybook/internal/client-logger';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';
import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { emitTransformCode, getService } from 'storybook/preview-api';

import { argsToFill, getFillTemplate, selectLiveSnippetForStory } from './live-snippet.ts';

export { shouldSkipStoryDocsEmit };

// The first render of each version of a story loads its component's story docs; the server keeps
// them current after that. Keyed on the story's parameters, which an args change keeps and a hot
// update replaces, so filling in new args needs no request.
const loads = new WeakMap<object, Promise<unknown>>();

// The latest emit of each story. Each emit waits for the one before it, so with an async
// `transform` the Code panel, which shows the last one, ends on the newest args. None is skipped:
// a docs page renders a story with its current and its initial args, and looks each one up.
const emits = new Map<string, Promise<unknown>>();

/**
 * Preview `beforeEach` hook that emits a story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}. It runs again on every args change, which fills the story's `template`
 * with the new args.
 */
export function storyDocsSourceBeforeEach(context: StoryContext): CleanupCallback | void {
  if (!globalThis.FEATURES?.docgenServer) {
    return;
  }
  if (shouldSkipStoryDocsEmit(context.parameters)) {
    return;
  }

  const service = (() => {
    try {
      return getService('core/story-docs', { internal: true });
    } catch {
      return undefined;
    }
  })();
  if (!service) {
    return;
  }

  const storyId = context.id;
  const componentId = storyId.split('--')[0]!;
  let cancelled = false;

  // Do not await story-docs I/O here — story render should start immediately. Cleanup flips
  // `cancelled` so a slow load cannot emit after the story is torn down, then returns the chain
  // so navigation waits for in-flight work to settle.
  const query = service.queries.storyDocs;
  let load = loads.get(context.parameters);
  if (!load) {
    load = query.loaded({ id: componentId });
    loads.set(context.parameters, load);
    // A failed load is tried again on the next render.
    load.catch(() => loads.delete(context.parameters));
  }
  const previous = emits.get(storyId);
  const codePanelSnippetPromise: Promise<unknown> = Promise.all([load, previous])
    .then(() => {
      if (cancelled) {
        return;
      }
      const { snippet, warning } = selectLiveSnippetForStory(
        query.get({ id: componentId }),
        storyId,
        argsToFill({
          args: context.args,
          unmappedArgs: context.unmappedArgs,
          initialArgs: context.initialArgs,
        }),
        getFillTemplate(context.parameters)
      );
      const source = snippet ?? context.parameters?.docs?.source?.originalSource;
      if (source === undefined) {
        return;
      }

      return emitTransformCode(
        source,
        context,
        snippet === undefined && warning ? `${warning} Showing the story source instead.` : warning
      );
    })
    // The snippet is a Code panel nicety; a failed load must not surface as an unhandled rejection
    // that fails the story's play function.
    .catch((error: unknown) => {
      logger.debug(`Story docs snippet for ${storyId} unavailable: ${String(error)}`);
    });
  emits.set(storyId, codePanelSnippetPromise);

  return () => {
    cancelled = true;
    return codePanelSnippetPromise;
  };
}
