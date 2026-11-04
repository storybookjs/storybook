import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PreparedStory, StoryDoc, StoryDocsPayload } from 'storybook/internal/types';

import {
  type QueryState,
  type StoryArgs,
  getPrintHole,
  loadStoryTemplates,
  selectLiveSnippetForStory,
  selectStoryDoc,
  storyArgsChanged,
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
  args: StoryArgs
): QueryState<{ snippet?: string; warning?: string }> {
  // The selector is stable, so an args change fills the template again without a new subscription,
  // which would load the story docs again.
  const state = useServiceStory(story.id, selectStoryWithTemplate);
  const printHole = getPrintHole(story.parameters);
  const service = getService('core/story-docs', { internal: true });
  const componentId = story.id.split('--')[0]!;
  const changed = storyArgsChanged(args);
  const templates = state.data?.templates;
  // The templates load apart from the story docs, the first time the args change, and again on
  // each change after a load that brought none.
  const [loadedFor, setLoadedFor] = useState<string>();
  const retryOn = loadedFor === componentId && templates === undefined ? args : undefined;
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
  }, [changed, service, componentId, retryOn]);
  const data = useMemo(
    () =>
      selectLiveSnippetForStory(
        state.data?.payload,
        templates ?? (loadedFor === componentId ? undefined : 'loading'),
        story.id,
        args,
        printHole
      ),
    [state.data, templates, story.id, args, printHole, componentId, loadedFor]
  );
  return useMemo(() => ({ ...state, data }), [state, data]);
}

// This story's docs and template. A subscription re-runs only for the state its selector reads, and
// an update can change a story's fields in place, so the story is copied field by field. The
// template is read here rather than subscribed to, which would load it at once, so an update that
// changes only the template still re-runs the selector.
function selectStoryWithTemplate(payload: StoryDocsPayload | undefined, storyId: string) {
  const story = payload?.stories[storyId];
  const templates = getService('core/story-docs', { internal: true }).queries.storyTemplates.get({
    id: storyId.split('--')[0]!,
  });
  const template = templates?.stories[storyId];
  return {
    payload: payload && { ...payload, stories: story ? { [storyId]: { ...story } } : {} },
    templates: templates && { stories: template === undefined ? {} : { [storyId]: template } },
  };
}
