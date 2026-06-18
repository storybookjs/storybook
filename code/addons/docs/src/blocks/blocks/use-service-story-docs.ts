import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { StoryDoc, StoryDocsPayload } from 'storybook/internal/types';

import {
  type QueryState,
  type StoryDocsService,
  seedQueryState,
  selectSnippetForStory,
  selectStoryDoc,
} from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

/**
 * Subscribes docs blocks to one story in the preview's local `core/story-docs` runtime.
 *
 * Derives the component id from the story id and uses the query's selector subscription so the
 * callback only fires when the selected story slice changes — not when a sibling story in the same
 * CSF file updates. Returns the full {@link QueryState} — the selected `data` plus the load lifecycle
 * (`isInitialLoading`, `isError`, etc.) — so blocks can react to loading and error states.
 *
 * Requires a concrete story id and a registered `core/story-docs` service. Callers whose service may
 * be absent must guard at a parent and conditionally render a child that calls this hook.
 *
 * Deliberately does NOT reuse the manager-side `useServiceQuery` (built on the React 18-only
 * `useSyncExternalStore`): the preview-side docs blocks must keep working on React 16/17. This is a
 * small, query-specific subscription instead — the selected slice is seeded synchronously during
 * render and the subscription forces a re-render whenever that slice changes.
 */
export function useServiceStory<TSelected>(
  storyId: string,
  selector: (payload: StoryDocsPayload | undefined, storyId: string) => TSelected
): QueryState<TSelected> {
  const componentId = storyId.split('--')[0]!;
  const service = useMemo(() => getService<StoryDocsService>('core/story-docs'), []);
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0);
  const cache = useRef<{ storyId: string; state: QueryState<TSelected> }>(undefined);

  // Kept stable (selectors are compared by reference on the subscription) so we don't re-subscribe
  // every render.
  const boundSelector = useCallback(
    (payload: StoryDocsPayload | undefined) => selector(payload, storyId),
    [selector, storyId]
  );

  if (cache.current?.storyId !== storyId) {
    cache.current = {
      storyId,
      state: seedQueryState(service.queries.getStoryDocs, { id: componentId }, boundSelector),
    };
  }

  useEffect(() => {
    return service.queries.getStoryDocs.subscribe({ id: componentId }, boundSelector, (state) => {
      cache.current = { storyId, state };
      forceRender();
    });
  }, [service, componentId, storyId, boundSelector]);

  return cache.current.state;
}

/** Convenience hook for the common case: the story-docs entry for one story. */
export function useServiceStoryDoc(storyId: string): QueryState<StoryDoc | undefined> {
  return useServiceStory(storyId, selectStoryDoc);
}

/** Convenience hook returning one story's display snippet (with its CSF import block prepended). */
export function useServiceStorySnippet(storyId: string): QueryState<string | undefined> {
  return useServiceStory(storyId, selectSnippetForStory);
}
