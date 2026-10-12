import { useCallback, useMemo } from 'react';

import type { Args, PreparedStory, StoryDoc, StoryDocsPayload } from 'storybook/internal/types';

import {
  type QueryState,
  getFillTemplate,
  selectLiveSnippetForStory,
  selectStoryDoc,
} from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

import { useQuerySubscription } from './use-query-subscription.ts';

/**
 * Subscribes docs blocks to one story in the preview's local `core/story-docs` runtime.
 *
 * Derives the component id from the story id and uses the query's selector subscription so the
 * callback only fires when the selected story slice changes — not when a sibling story in the same
 * CSF file updates. Returns the full {@link QueryState} — the selected `data` plus the load lifecycle
 * (`isInitialLoading`, `isError`, etc.) — so blocks can react to loading and error states.
 *
 * Requires a concrete story id and a registered `core/story-docs` service. Callers whose service may
 * be absent must guard at a parent and conditionally render a child that calls this hook. The React
 * 16/17-safe subscription mechanics live in {@link useQuerySubscription}.
 */
export function useServiceStory<TSelected>(
  storyId: string,
  selector: (payload: StoryDocsPayload | undefined, storyId: string) => TSelected
): QueryState<TSelected> {
  const componentId = storyId.split('--')[0]!;
  const service = getService('core/story-docs', { internal: true });

  // Kept stable (selectors are compared by reference on the subscription) so we don't re-subscribe
  // every render.
  const boundSelector = useCallback(
    (payload: StoryDocsPayload | undefined) => selector(payload, storyId),
    [selector, storyId]
  );

  // Keyed on `storyId` (not `componentId`): the selected slice is per-story, so switching between
  // sibling stories in the same component must re-seed and re-subscribe with the new selector.
  return useQuerySubscription(
    storyId,
    service.queries.storyDocs,
    { id: componentId },
    boundSelector
  );
}

/** Convenience hook for the common case: the story-docs entry for one story. */
export function useServiceStoryDoc(storyId: string): QueryState<StoryDoc | undefined> {
  return useServiceStory(storyId, selectStoryDoc);
}

/**
 * One story's display snippet with `args` filled into its template by the story's renderer, or its
 * static snippet and warning when there are no args to fill or it has no template.
 */
export function useServiceStoryLiveSnippet(
  story: PreparedStory,
  args: Args | undefined
): QueryState<{ snippet?: string; warning?: string }> {
  // The selector is stable, so an args change fills the template again without a new subscription,
  // which would load the story docs again.
  const state = useServiceStory(story.id, selectPayload);
  const fill = getFillTemplate(story.parameters);
  const data = useMemo(
    () => selectLiveSnippetForStory(state.data, story.id, args, fill),
    [state.data, story.id, args, fill]
  );
  return useMemo(() => ({ ...state, data }), [state, data]);
}

const selectPayload = (payload: StoryDocsPayload | undefined) => payload;
