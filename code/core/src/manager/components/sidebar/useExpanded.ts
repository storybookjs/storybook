import type { Dispatch, Reducer } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { STORIES_COLLAPSE_ALL, STORIES_EXPAND_ALL } from 'storybook/internal/core-events';

import type { StoriesHash } from 'storybook/manager-api';
import { useStorybookApi } from 'storybook/manager-api';

import { getAncestorIds } from '../../utils/tree.ts';

export type ExpandedState = Set<string>;

export interface ExpandAction {
  ids: string[];
  append?: boolean;
  value?: boolean;
}

export interface ExpandedProps {
  data: StoriesHash;
  selectedStoryId: string | null;
}

const initializeExpanded = ({
  data,
  initialExpanded,
  selectedStoryId,
}: {
  data: StoriesHash;
  initialExpanded: ExpandedState;
  selectedStoryId: string | null;
}) => {
  const selectedStory = selectedStoryId && data[selectedStoryId];
  const candidates: string[] = [];
  if (selectedStory && 'children' in selectedStory && selectedStory.children?.length) {
    candidates.push(selectedStoryId);
  }

  return new Set([...candidates, ...initialExpanded]);
};

export const useExpanded = ({
  data,
  selectedStoryId,
}: ExpandedProps): [Set<string>, Dispatch<ExpandAction>] => {
  const api = useStorybookApi();

  const initialExpanded = useMemo(
    () =>
      new Set(
        Object.entries(data)
          .filter(([, item]) => item.type === 'root' && !item.startCollapsed)
          .map(([key]) => key)
      ),
    [data]
  );

  // Track the set of currently expanded nodes within this tree.
  // Root nodes are expanded by default.
  const [expanded, setExpanded] = useReducer<
    Reducer<ExpandedState, ExpandAction>,
    {
      data: StoriesHash;
      initialExpanded: ExpandedState;
      selectedStoryId: string | null;
    }
  >(
    (state, { ids, append, value }) => {
      // A no-op action must return the same Set. The tree uses the identity of the Set as a
      // react-aria collection dependency, and a new identity re-renders every row. The selection
      // effect below dispatches on every story change, and the dispatch is usually redundant.
      if (append) {
        if (value) {
          if (ids.every((id) => state.has(id))) {
            return state;
          }
          return new Set([...state, ...ids]);
        }
        const remaining = [...state].filter((id) => !ids.includes(id));
        return remaining.length === state.size ? state : new Set(remaining);
      }
      if (ids.length === state.size && ids.every((id) => state.has(id))) {
        return state;
      }
      return new Set(ids);
    },
    { data, initialExpanded, selectedStoryId },
    initializeExpanded
  );

  // Expand the whole ancestry of the currently selected story whenever it changes.
  useEffect(() => {
    if (selectedStoryId) {
      setExpanded({ ids: getAncestorIds(data, selectedStoryId), append: true, value: true });
    }
  }, [data, selectedStoryId]);

  // A default root that appears after mount (a ref index arriving, a new section in dev) started
  // collapsed: the reducer initialized before the root existed. Expand each default root when it
  // is first seen, and only then, so that a root the user collapsed afterwards stays collapsed.
  const seenRootsRef = useRef<Set<string> | null>(null);
  seenRootsRef.current ??= new Set(initialExpanded);
  useEffect(() => {
    const seenRoots = seenRootsRef.current!;
    const newRoots = [...initialExpanded].filter((id) => !seenRoots.has(id));
    if (newRoots.length === 0) {
      return;
    }
    newRoots.forEach((id) => seenRoots.add(id));
    setExpanded({ ids: newRoots, append: true, value: true });
  }, [initialExpanded]);

  // Handlers for the global collapse-all and expand-all keyboard shortcuts. Collapse-all keeps
  // the default root sections open, as on first load. A collapse of the roots too would reduce
  // the sidebar to bare section headers.
  const collapseAll = useCallback(() => {
    setExpanded({ ids: [...initialExpanded] });
  }, [initialExpanded]);

  const expandAll = useCallback(() => {
    setExpanded({
      ids: Object.entries(data)
        .filter(([, value]) => 'children' in value)
        .map(([key]) => key),
    });
  }, [data]);

  useEffect(() => {
    api.on(STORIES_COLLAPSE_ALL, collapseAll);
    api.on(STORIES_EXPAND_ALL, expandAll);

    return () => {
      api.off(STORIES_COLLAPSE_ALL, collapseAll);
      api.off(STORIES_EXPAND_ALL, expandAll);
    };
  }, [api, collapseAll, expandAll]);

  return [expanded, setExpanded];
};
