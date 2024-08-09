import type { Dispatch, MutableRefObject, Reducer } from 'react';
import { useCallback, useEffect, useReducer } from 'react';

import { global } from '@storybook/global';

import { STORIES_COLLAPSE_ALL, STORIES_EXPAND_ALL } from '@storybook/core/core-events';
import type { StoriesHash } from '@storybook/core/manager-api';
import { useStorybookApi } from '@storybook/core/manager-api';

import throttle from 'lodash/throttle.js';

import { matchesKeyCode, matchesModifiers } from '../../keybinding';
import { getAncestorIds, getDescendantIds, isAncestor, scrollIntoView } from '../../utils/tree';
import type { Highlight } from './types';

const { document } = global;

export type ExpandedState = Record<string, boolean>;

export interface ExpandAction {
  ids: string[];
  value: boolean;
}

export interface ExpandedProps {
  containerRef: MutableRefObject<HTMLElement>;
  isBrowsing: boolean;
  refId: string;
  data: StoriesHash;
  initialExpanded?: ExpandedState;
  rootIds: string[];
  highlightedRef: MutableRefObject<Highlight>;
  setHighlightedItemId: (storyId: string) => void;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}

const initializeExpanded = ({
  refId,
  data,
  initialExpanded,
  highlightedRef,
  rootIds,
}: {
  refId: string;
  data: StoriesHash;
  initialExpanded?: ExpandedState;
  highlightedRef: MutableRefObject<Highlight>;
  rootIds: string[];
}) => {
  const highlightedAncestors =
    highlightedRef.current?.refId === refId
      ? getAncestorIds(data, highlightedRef.current?.itemId)
      : [];
  return [...rootIds, ...highlightedAncestors].reduce<ExpandedState>(
    // @ts-expect-error (non strict)
    (acc, id) => Object.assign(acc, { [id]: id in initialExpanded ? initialExpanded[id] : true }),
    {}
  );
};

const noop = () => {};

export const useExpanded = ({
  containerRef,
  isBrowsing,
  refId,
  data,
  initialExpanded,
  rootIds,
  highlightedRef,
  setHighlightedItemId,
  selectedStoryId,
  onSelectStoryId,
}: ExpandedProps): [ExpandedState, Dispatch<ExpandAction>] => {
  const api = useStorybookApi();

  // Track the set of currently expanded nodes within this tree.
  // Root nodes are expanded by default.
  const [expanded, setExpanded] = useReducer<
    Reducer<ExpandedState, ExpandAction>,
    {
      refId: string;
      data: StoriesHash;
      highlightedRef: MutableRefObject<Highlight>;
      rootIds: string[];
      initialExpanded: ExpandedState;
    }
  >(
    (state, { ids, value }) =>
      ids.reduce((acc, id) => Object.assign(acc, { [id]: value }), { ...state }),
    // @ts-expect-error (non strict)
    { refId, data, highlightedRef, rootIds, initialExpanded },
    initializeExpanded
  );

  const getElementByDataItemId = useCallback(
    (id: string) => containerRef.current?.querySelector(`[data-item-id="${id}"]`),
    [containerRef]
  );

  const highlightElement = useCallback(
    (element: Element) => {
      // @ts-expect-error (non strict)
      setHighlightedItemId(element.getAttribute('data-item-id'));
      scrollIntoView(element);
    },
    [setHighlightedItemId]
  );

  const updateExpanded = useCallback(
    ({ ids, value }: ExpandAction) => {
      // @ts-expect-error (non strict)
      setExpanded({ ids, value });
      if (ids.length === 1) {
        const element = containerRef.current?.querySelector(
          `[data-item-id="${ids[0]}"][data-ref-id="${refId}"]`
        );
        if (element) highlightElement(element);
      }
    },
    [containerRef, highlightElement, refId]
  );

  // Expand the whole ancestry of the currently selected story whenever it changes.
  useEffect(() => {
    // @ts-expect-error (non strict)
    setExpanded({ ids: getAncestorIds(data, selectedStoryId), value: true });
  }, [data, selectedStoryId]);

  const collapseAll = useCallback(() => {
    const ids = Object.keys(data).filter((id) => !rootIds.includes(id));
    // @ts-expect-error (non strict)
    setExpanded({ ids, value: false });
  }, [data, rootIds]);

  const expandAll = useCallback(() => {
    // @ts-expect-error (non strict)
    setExpanded({ ids: Object.keys(data), value: true });
  }, [data]);

  useEffect(() => {
    if (!api) return noop;

    api.on(STORIES_COLLAPSE_ALL, collapseAll);
    api.on(STORIES_EXPAND_ALL, expandAll);

    return () => {
      api.off(STORIES_COLLAPSE_ALL, collapseAll);
      api.off(STORIES_EXPAND_ALL, expandAll);
    };
  }, [api, collapseAll, expandAll]);

  // Expand, collapse or select nodes in the tree using keyboard shortcuts.
  useEffect(() => {
    const menuElement = document.getElementById('storybook-explorer-menu');

    // Even though we ignore repeated events, use throttle because IE doesn't support event.repeat.
    const navigateTree = throttle((event: KeyboardEvent) => {
      const highlightedItemId =
        highlightedRef.current?.refId === refId && highlightedRef.current?.itemId;
      if (!isBrowsing || !containerRef.current || !highlightedItemId || event.repeat) return;
      if (!matchesModifiers(false, event)) return;

      const isEnter = matchesKeyCode('Enter', event);
      const isSpace = matchesKeyCode('Space', event);
      const isArrowLeft = matchesKeyCode('ArrowLeft', event);
      const isArrowRight = matchesKeyCode('ArrowRight', event);
      if (!(isEnter || isSpace || isArrowLeft || isArrowRight)) return;

      const highlightedElement = getElementByDataItemId(highlightedItemId);
      if (!highlightedElement || highlightedElement.getAttribute('data-ref-id') !== refId) return;

      const target = event.target as Element;
      // @ts-expect-error (non strict)
      if (!isAncestor(menuElement, target) && !isAncestor(target, menuElement)) return;
      if (target.hasAttribute('data-action')) {
        if (isEnter || isSpace) return;
        (target as HTMLButtonElement).blur();
      }

      const type = highlightedElement.getAttribute('data-nodetype');
      // @ts-expect-error (non strict)
      if ((isEnter || isSpace) && ['component', 'story', 'document'].includes(type)) {
        onSelectStoryId(highlightedItemId);
      }

      const isExpanded = highlightedElement.getAttribute('aria-expanded');

      if (isArrowLeft) {
        if (isExpanded === 'true') {
          // The highlighted node is expanded, so we collapse it.
          // @ts-expect-error (non strict)
          setExpanded({ ids: [highlightedItemId], value: false });
          return;
        }

        const parentId = highlightedElement.getAttribute('data-parent-id');
        const parentElement = parentId && getElementByDataItemId(parentId);
        if (parentElement && parentElement.getAttribute('data-highlightable') === 'true') {
          // The highlighted node isn't expanded, so we move the highlight to its parent instead.
          highlightElement(parentElement);
          return;
        }

        // The parent can't be highlighted, which means it must be a root.
        // The highlighted node is already collapsed, so we collapse its descendants.
        // @ts-expect-error (non strict)
        setExpanded({ ids: getDescendantIds(data, highlightedItemId, true), value: false });
        return;
      }

      if (isArrowRight) {
        if (isExpanded === 'false') {
          updateExpanded({ ids: [highlightedItemId], value: true });
        } else if (isExpanded === 'true') {
          updateExpanded({ ids: getDescendantIds(data, highlightedItemId, true), value: true });
        }
      }
    }, 60);

    document.addEventListener('keydown', navigateTree);
    return () => document.removeEventListener('keydown', navigateTree);
  }, [
    containerRef,
    isBrowsing,
    refId,
    data,
    highlightedRef,
    setHighlightedItemId,
    onSelectStoryId,
  ]);

  return [expanded, updateExpanded];
};
