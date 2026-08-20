import { once } from 'storybook/internal/client-logger';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';
import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { StoryDocsSnippetSourceParameters } from './snippet.ts';
import { selectSnippetForStory } from './snippet.ts';

export { shouldSkipStoryDocsEmit };

type LiveStory = {
  /** Serializes emits across renders so a slow transform cannot let an older snippet land last. */
  queue: Promise<void>;
  /** Bumped per render; a queued emit from an earlier generation is dropped instead of emitted. */
  generation: number;
  stop?: () => void;
};

// `beforeEach` runs on every args-driven render, while its cleanups wait for teardown. Keeping one
// record per story replaces the active subscription and orders its emits, so neither an HMR update
// nor an async `docs.source.transform` can replay snippets built with stale args.
const liveStories = new Map<string, LiveStory>();

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

  let liveStory = liveStories.get(storyId);
  if (!liveStory) {
    liveStory = { queue: Promise.resolve(), generation: 0 };
    liveStories.set(storyId, liveStory);
  }
  const live = liveStory;
  const generation = ++live.generation;
  const previousStop = live.stop;
  live.stop = undefined;
  previousStop?.();

  const scheduleEmit = (source: string | undefined) => {
    if (source === undefined || source === lastSource) {
      return;
    }
    lastSource = source;
    live.queue = live.queue.then(async () => {
      if (cancelled || live.generation !== generation) {
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

  const stop = () => {
    if (cancelled) {
      return;
    }
    cancelled = true;
    unsubscribe();
    if (live.generation === generation) {
      live.stop = undefined;
      if (liveStories.get(storyId) === live) {
        liveStories.delete(storyId);
      }
    }
  };
  live.stop = stop;

  return () => {
    stop();
    return live.queue;
  };
}
