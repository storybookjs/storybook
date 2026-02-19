import type { Dispatch, Reducer } from 'react';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { STORIES_COLLAPSE_ALL, STORIES_EXPAND_ALL } from 'storybook/internal/core-events';

import type { StoriesHash } from 'storybook/manager-api';
import { useStorybookApi } from 'storybook/manager-api';

import { getAncestorIds } from '../../utils/tree.ts';

// TODO/FIXME: Record<string, boolean> was likely better for performance.

export type ExpandedState = string[];

export interface ExpandAction {
  ids: string[];
  append?: boolean;
  value?: boolean;
}

export interface ExpandedProps {
  refId: string;
  data: StoriesHash;
  initialExpanded?: ExpandedState;
  selectedStoryId: string | null;
}

const initializeExpanded = ({
  data,
  initialExpanded = [],
  selectedStoryId,
}: {
  data: StoriesHash;
  initialExpanded?: ExpandedState;
  selectedStoryId: string | null;
}) => {
  const selectedStory = selectedStoryId && data[selectedStoryId];
  const candidates = [];
  // TODO/FIXME: this might not be necessary based on the order of rendering between the selected story ID and this hook.
  // If still necessary, reimplement by checking the data-story-id of document.activeElement instead of highlightedRef.
  // if (highlightedRef.current?.refId === refId) {
  //   candidates.push(...getAncestorIds(data, highlightedRef.current?.itemId));
  // }
  if (selectedStory && 'children' in selectedStory && selectedStory.children?.length) {
    candidates.push(selectedStoryId);
  }

  return [...candidates, ...initialExpanded];
};

const noop = () => {};

export const useExpanded = ({
  refId,
  data,
  selectedStoryId,
}: ExpandedProps): [string[], Dispatch<ExpandAction>] => {
  const api = useStorybookApi();

  const initialExpanded = useMemo(
    () =>
      Object.entries(data)
        .filter(([, item]) => item.type === 'root' && !item.startCollapsed)
        .map(([key]) => key),
    [data]
  );

  // Track the set of currently expanded nodes within this tree.
  // Root nodes are expanded by default.
  const [expanded, setExpanded] = useReducer<
    Reducer<ExpandedState, ExpandAction>,
    {
      refId: string;
      data: StoriesHash;
      initialExpanded: ExpandedState;
      selectedStoryId: string | null;
    }
  >(
    (state, { ids, append, value }) => {
      if (append) {
        if (value) {
          return Array.from(new Set([...state, ...ids]));
        } else {
          return state.filter((id) => !ids.includes(id));
        }
      } else {
        return ids;
      }
    },
    { refId, data, initialExpanded, selectedStoryId },
    initializeExpanded
  );

  // Expand the whole ancestry of the currently selected story whenever it changes.
  useEffect(() => {
    if (selectedStoryId) {
      setExpanded({ ids: getAncestorIds(data, selectedStoryId), append: true, value: true });
    }
  }, [data, selectedStoryId]);

  // Add event handlers for collapse all / expand all global keyboard shortcuts.
  const collapseAll = useCallback(() => {
    setExpanded({ ids: [] });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded({
      ids: Object.entries(data)
        .filter(([, value]) => 'children' in value)
        .map(([key]) => key),
    });
  }, [data]);

  useEffect(() => {
    if (!api) {
      return noop;
    }

    api.on(STORIES_COLLAPSE_ALL, collapseAll);
    api.on(STORIES_EXPAND_ALL, expandAll);

    return () => {
      api.off(STORIES_COLLAPSE_ALL, collapseAll);
      api.off(STORIES_EXPAND_ALL, expandAll);
    };
  }, [api, collapseAll, expandAll]);

  return [expanded, setExpanded];
};
