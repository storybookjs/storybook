import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PreparedStory, StoryDoc, StoryDocsPayload } from 'storybook/internal/types';

import {
  type QueryState,
  type StoryArgs,
  argsChanged,
  getPrintHole,
  loadStoryTemplates,
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

// One story's display snippet with its `args` filled into its template by the story's renderer, or
// its static snippet and warning while it has the args it is written with or no template.
export function useServiceStoryLiveSnippet(
  story: PreparedStory,
  args: StoryArgs | undefined
): QueryState<{ snippet?: string; warning?: string }> {
  // The selector is stable, so an args change fills the template again without a new subscription,
  // which would load the story docs again.
  const state = useServiceStory(story.id, selectStoryPayload);
  const printHole = getPrintHole(story.parameters);
  const service = getService('core/story-docs', { internal: true });
  const componentId = story.id.split('--')[0]!;
  const changed = argsChanged(args);
  // The templates load apart from the story docs, once the args first change. They are read, not
  // subscribed to, as a subscription would load them at once; one extraction updates them and the
  // story docs together, which the subscription above follows.
  const [loadedFor, setLoadedFor] = useState<string>();
  useEffect(() => {
    if (!changed) {
      return;
    }
    let mounted = true;
    void loadStoryTemplates(service, componentId).then(() => {
      if (mounted) {
        setLoadedFor(componentId);
      }
    });
    return () => {
      mounted = false;
    };
  }, [changed, service, componentId]);
  const data = useMemo(
    () => {
      const templates = service.queries.storyTemplates.get({ id: componentId });
      return selectLiveSnippetForStory(
        state.data,
        templates ?? (loadedFor === componentId ? undefined : 'loading'),
        story.id,
        args,
        printHole
      );
    },
    // `loadedFor` is the trigger: the templates are read from the service, not from it.
    [state.data, story.id, args, printHole, service, componentId, loadedFor]
  );
  return useMemo(() => ({ ...state, data }), [state, data]);
}

// A plain copy of the payload with only this story's docs. The subscription compares what the
// selector returns with what it returned before, and the payload itself is state that changes in
// place, so it would always compare equal.
function selectStoryPayload(payload: StoryDocsPayload | undefined, storyId: string) {
  const story = payload?.stories[storyId];
  return payload && { ...payload, stories: story ? { [storyId]: { ...story } } : {} };
}
