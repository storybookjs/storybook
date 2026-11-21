import { useCallback, useEffect, useState } from 'react';

import { debounce } from 'es-toolkit/function';
import store from 'store2';

import type { Selection, StoryRef } from './types.ts';

const save = debounce((value) => store.set('lastViewedStoryIds', value), 1000);

const isStoryRef = (item: unknown): item is StoryRef => {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const { storyId, refId, anchor } = item as Partial<Record<keyof StoryRef, unknown>>;
  return (
    typeof storyId === 'string' &&
    storyId !== '' &&
    typeof refId === 'string' &&
    refId !== '' &&
    (anchor === undefined || typeof anchor === 'string')
  );
};

const getStoredLastViewed = (): StoryRef[] => {
  const items: unknown = store.get('lastViewedStoryIds');
  return Array.isArray(items) ? items.filter(isStoryRef) : [];
};

export const useLastViewed = (selection: Selection) => {
  const [lastViewed, setLastViewed] = useState(getStoredLastViewed);

  useEffect(() => {
    if (!selection) {
      return;
    }
    const index = lastViewed.findIndex(
      ({ storyId, refId, anchor }) =>
        storyId === selection.storyId && refId === selection.refId && anchor === selection.anchor
    );
    if (index === 0) {
      return;
    }
    const next = [selection, ...lastViewed.filter((_, i) => i !== index)];
    setLastViewed(next);
    save(next);
  }, [selection, lastViewed]);

  const clearLastViewed = useCallback(() => {
    const next = lastViewed.slice(0, 1);
    setLastViewed(next);
    save(next);
  }, [lastViewed]);

  return { lastViewed, clearLastViewed };
};
