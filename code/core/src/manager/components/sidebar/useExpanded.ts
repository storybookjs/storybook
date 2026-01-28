import type { Dispatch, MutableRefObject, Reducer } from 'react';
import { useCallback, useEffect, useReducer } from 'react';

import { STORIES_COLLAPSE_ALL, STORIES_EXPAND_ALL } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import { throttle } from 'es-toolkit/function';
import type { StoriesHash } from 'storybook/manager-api';
import { useStorybookApi } from 'storybook/manager-api';

import { matchesKeyCode, matchesModifiers } from '../../keybinding.ts';
import { getAncestorIds, getDescendantIds, isAncestor, scrollIntoView } from '../../utils/tree.ts';
import type { Highlight } from './types.ts';

// const { document } = global;

export type ExpandedState = Record<string, boolean>;

export interface ExpandAction {
  ids: string[];
  value: boolean;
}

export interface ExpandedProps {
  // containerRef: MutableRefObject<HTMLElement>;
  // isBrowsing: boolean;
  refId: string;
  data: StoriesHash;
  initialExpanded?: ExpandedState;
  rootIds: string[];
  // highlightedRef: MutableRefObject<Highlight>;
  // setHighlightedItemId: (storyId: string) => void;
  selectedStoryId: string | null;
  // onSelectStoryId: (storyId: string) => void;
}

const initializeExpanded = ({
  refId,
  data,
  initialExpanded = {},
  // highlightedRef,
  rootIds,
  selectedStoryId,
}: {
  refId: string;
  data: StoriesHash;
  initialExpanded?: ExpandedState;
  // highlightedRef: MutableRefObject<Highlight>;
  rootIds: string[];
  selectedStoryId: string | null;
}) => {
  const selectedStory = selectedStoryId && data[selectedStoryId];
  const candidates = [...rootIds];
  // if (highlightedRef.current?.refId === refId) {
  //   candidates.push(...getAncestorIds(data, highlightedRef.current?.itemId));
  // }
  if (selectedStory && 'children' in selectedStory && selectedStory.children?.length) {
    candidates.push(selectedStoryId);
  }
  return candidates.reduce<ExpandedState>(
    (acc, id) => Object.assign(acc, { [id]: id in initialExpanded ? initialExpanded[id] : true }),
    {}
  );
};

const noop = () => {};

export const useExpanded = ({
  // containerRef,
  // isBrowsing,
  refId,
  data,
  initialExpanded = {},
  rootIds,
  // highlightedRef,
  // setHighlightedItemId,
  selectedStoryId,
  // onSelectStoryId,
}: ExpandedProps): [ExpandedState, Dispatch<ExpandAction>] => {
  const api = useStorybookApi();

  // Track the set of currently expanded nodes within this tree.
  // Root nodes are expanded by default.
  const [expanded, setExpanded] = useReducer<
    Reducer<ExpandedState, ExpandAction>,
    {
      refId: string;
      data: StoriesHash;
      // highlightedRef: MutableRefObject<Highlight>;
      rootIds: string[];
      initialExpanded: ExpandedState;
      selectedStoryId: string | null;
    }
  >(
    (state, { ids, value }) =>
      ids.reduce(
        (acc, id) => {
          // TODO/FIXME: check if this is truly needed, or if I can find another way to handle whatever happened in init.
          // Always expand the parents of any expanded id.
          const delta = value
            ? Object.fromEntries(getAncestorIds(data, id).map((ancestorId) => [ancestorId, true]))
            : { [id]: false };

          return Object.assign(acc, delta);
        },
        { ...state }
      ),
    // { refId, data, highlightedRef, rootIds, initialExpanded, selectedStoryId },
    { refId, data, rootIds, initialExpanded, selectedStoryId },
    initializeExpanded
  );

  // const getElementByDataItemId = useCallback(
  //   (id: string) => containerRef.current?.querySelector(`[data-item-id="${id}"]`),
  //   [containerRef]
  // );

  // const highlightElement = useCallback(
  //   (element: Element) => {
  //     // @ts-expect-error (non strict)
  //     setHighlightedItemId(element.getAttribute('data-item-id'));
  //     scrollIntoView(element);
  //   },
  //   [setHighlightedItemId]
  // );

  // const updateExpanded = useCallback(
  //   ({ ids, value }: ExpandAction) => {
  //     setExpanded({ ids, value });
  //     if (ids.length === 1) {
  //       const element = containerRef.current?.querySelector(
  //         `[data-item-id="${ids[0]}"][data-ref-id="${refId}"]`
  //       );

  //       if (element) {
  //         highlightElement(element);
  //       }
  //     }
  //   },
  //   [containerRef, highlightElement, refId]
  // );

  // Expand the whole ancestry of the currently selected story whenever it changes.
  useEffect(() => {
    if (selectedStoryId) {
      setExpanded({ ids: getAncestorIds(data, selectedStoryId), value: true });
    }
  }, [data, selectedStoryId]);

  const collapseAll = useCallback(() => {
    const ids = Object.keys(data).filter((id) => !rootIds.includes(id));
    setExpanded({ ids, value: false });
  }, [data, rootIds]);

  const expandAll = useCallback(() => {
    setExpanded({ ids: Object.keys(data), value: true });
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
