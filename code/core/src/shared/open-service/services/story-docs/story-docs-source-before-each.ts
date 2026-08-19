import { once } from 'storybook/internal/client-logger';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';
import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { emitTransformCode, getService } from 'storybook/preview-api';

import { selectSnippetForStory } from './snippet.ts';

export { shouldSkipStoryDocsEmit };

/**
 * Preview `beforeEach` hook that emits the story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}.
 *
 * Runs on every story invocation, which includes every args change, so passing the context's args
 * through is what makes the Code panel track the Controls.
 */
export function storyDocsSourceBeforeEach(context: StoryContext): CleanupCallback | void {
  if (!globalThis.FEATURES?.experimentalDocgenServer) {
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
  const codePanelSnippetPromise = service.queries.storyDocs
    .loaded({ id: componentId })
    .then((payload) => {
      if (cancelled) {
        return;
      }
      const snippet = selectSnippetForStory(payload, storyId, context.unmappedArgs);
      const source = snippet ?? context.parameters?.docs?.source?.originalSource;
      if (source === undefined) {
        return;
      }
      return emitTransformCode(source, context);
    })
    // A failed load used to leave the Code panel blank forever while the docs Source block degraded
    // to the story's own source. Emitting the same fallback the success path uses makes the two
    // consumers of one payload fail the same way.
    .catch((error) => {
      once.warn(`Could not load code snippets for "${componentId}": ${String(error)}`);
      const fallback = context.parameters?.docs?.source?.originalSource;
      if (cancelled || fallback === undefined) {
        return;
      }
      return emitTransformCode(fallback, context);
    });

  return () => {
    cancelled = true;
    return codePanelSnippetPromise;
  };
}
