import { useCallback, useMemo, useRef } from 'react';

import type { StoryDoc, StoryDocsPayload } from 'storybook/internal/types';

import {
  type StoryDocsService,
  selectSnippetForStory,
  selectStoryDoc,
} from 'storybook/open-service';
import { getService } from 'storybook/preview-api';
import { useSyncExternalStoreShim } from './useSyncExternalStoreShim';

type SnapshotCache<T> = {
  storyId: string | undefined;
  value: T | undefined;
};

/**
 * Subscribes docs blocks to one story in the preview's local `core/story-docs` runtime.
 *
 * Derives the component id from the story id and uses the query's selector subscription so the
 * callback only fires when the selected story slice changes — not when a sibling story in the same
 * CSF file updates.
 */
export function useServiceStory<TSelected>(
  storyId: string | undefined,
  selector: (payload: StoryDocsPayload | undefined, storyId: string) => TSelected
): TSelected | undefined {
  const componentId = storyId ? storyId.split('--')[0] : undefined;
  const snapshotCache = useRef<SnapshotCache<TSelected>>({ storyId: undefined, value: undefined });
  const service = useMemo(() => {
    try {
      return getService<StoryDocsService>('core/story-docs');
    } catch {
      return undefined;
    }
  }, []);

  const getSnapshot = useCallback(() => {
    return snapshotCache.current.storyId === storyId ? snapshotCache.current.value : undefined;
  }, [storyId]);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!service || !componentId || !storyId) {
        return () => {};
      }

      return service.queries.getStoryDocs.subscribe(
        { id: componentId },
        (payload) => selector(payload, storyId),
        (selected) => {
          snapshotCache.current = { storyId, value: selected };
          listener();
        }
      );
    },
    [service, componentId, storyId, selector]
  );

  return useSyncExternalStoreShim(subscribe, getSnapshot);
}

/** Convenience hook for the common case: the story-docs entry for one story. */
export function useServiceStoryDoc(storyId: string | undefined): StoryDoc | undefined {
  return useServiceStory(storyId, selectStoryDoc);
}

/** Convenience hook returning one story's display snippet (with its CSF import block prepended). */
export function useServiceStorySnippet(storyId: string | undefined): string | undefined {
  return useServiceStory(storyId, selectSnippetForStory);
}
