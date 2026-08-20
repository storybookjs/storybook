import { once } from 'storybook/internal/client-logger';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';
import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { StoryDocsSnippetSourceParameters } from './snippet.ts';
import { selectSnippetForStory } from './snippet.ts';

export { shouldSkipStoryDocsEmit };

/**
 * Preview `beforeEach` hook that emits the story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}.
 *
 * `emitTransformCode` broadcasts `SNIPPET_RENDERED`, which the docs `SourceContainer` also stores
 * and the `Source` block reads back, so this hook feeds both consumers rather than only the panel.
 *
 * Runs on every story invocation, which includes every args change, so passing the context's args
 * through is what makes the snippet track the Controls.
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
  const sourceParameters = (context.parameters?.docs?.source ??
    {}) as StoryDocsSnippetSourceParameters & { originalSource?: string };
  let cancelled = false;
  let lastSource: string | undefined;
  let emitQueue = Promise.resolve();

  const scheduleEmit = (source: string | undefined) => {
    if (source === undefined || source === lastSource) {
      return;
    }
    lastSource = source;
    emitQueue = emitQueue.then(async () => {
      if (cancelled) {
        return;
      }
      try {
        await emitTransformCode(source, context);
      } catch (error) {
        once.warn(`Could not emit the code snippet for "${storyId}": ${String(error)}`);
      }
    });
  };

  const unsubscribe = service.queries.storyDocs.subscribe({ id: componentId }, (state) => {
    if (cancelled || (state.data === undefined && state.isInitialLoading)) {
      return;
    }
    if (state.isError) {
      once.warn(`Could not load code snippets for "${componentId}": ${String(state.error)}`);
    }
    scheduleEmit(
      selectSnippetForStory(
        state.data,
        storyId,
        context.unmappedArgs,
        sourceParameters.renderSnippetTemplate
      ) ?? sourceParameters.originalSource
    );
  });

  return () => {
    cancelled = true;
    unsubscribe();
    return emitQueue;
  };
}
