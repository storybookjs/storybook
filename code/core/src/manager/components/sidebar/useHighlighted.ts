import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { global } from '@storybook/global';

import { PRELOAD_ENTRIES } from '@storybook/core/core-events';
import { useStorybookApi } from '@storybook/core/manager-api';

import { matchesKeyCode, matchesModifiers } from '../../keybinding';
import { cycle, isAncestor, scrollIntoView } from '../../utils/tree';
import type { CombinedDataset, Highlight, Selection } from './types';

const { document, window: globalWindow } = global;

export interface HighlightedProps {
  containerRef: MutableRefObject<HTMLElement>;
  isLoading: boolean;
  isBrowsing: boolean;
  dataset: CombinedDataset;
  selected: Selection;
}

const fromSelection = (selection: Selection): Highlight =>
  selection ? { itemId: selection.storyId, refId: selection.refId } : null;

export const useHighlighted = ({
  containerRef,
  isLoading,
  isBrowsing,
  dataset,
  selected,
}: HighlightedProps): [
  Highlight,
  Dispatch<SetStateAction<Highlight>>,
  MutableRefObject<Highlight>,
] => {
  const initialHighlight = fromSelection(selected);
  const highlightedRef = useRef<Highlight>(initialHighlight);
  const [highlighted, setHighlighted] = useState<Highlight>(initialHighlight);
  const api = useStorybookApi();

  const updateHighlighted = useCallback(
    (highlight: Highlight) => {
      highlightedRef.current = highlight;
      setHighlighted(highlight);
    },
    [highlightedRef]
  );

  // Sets the highlighted node and scrolls it into view, using DOM elements as reference
  const highlightElement = useCallback(
    (element: Element, center = false) => {
      const itemId = element.getAttribute('data-item-id');
      const refId = element.getAttribute('data-ref-id');

      if (!itemId || !refId) {
        return;
      }
      updateHighlighted({ itemId, refId });
      scrollIntoView(element, center);
    },
    [updateHighlighted]
  );

  // Highlight and scroll to the selected story whenever the selection or dataset changes
  useEffect(() => {
    const highlight = fromSelection(selected);
    updateHighlighted(highlight);
    if (highlight) {
      const { itemId, refId } = highlight;
      setTimeout(() => {
        scrollIntoView(
          // @ts-expect-error (non strict)
          containerRef.current?.querySelector(`[data-item-id="${itemId}"][data-ref-id="${refId}"]`),
          true // make sure it's clearly visible by centering it
        );
      }, 0);
    }
  }, [dataset, highlightedRef, containerRef, selected]);

  // Highlight nodes up/down the tree using arrow keys
  useEffect(() => {
    const menuElement = document.getElementById('storybook-explorer-menu');

    let lastRequestId: number;
    const navigateTree = (event: KeyboardEvent) => {
      if (isLoading || !isBrowsing || !containerRef.current) {
        return; // allow event.repeat
      }

      if (!matchesModifiers(false, event)) {
        return;
      }

      const isArrowUp = matchesKeyCode('ArrowUp', event);
      const isArrowDown = matchesKeyCode('ArrowDown', event);

      if (!(isArrowUp || isArrowDown)) {
        return;
      }

      const requestId = globalWindow.requestAnimationFrame(() => {
        globalWindow.cancelAnimationFrame(lastRequestId);
        lastRequestId = requestId;

        const target = event.target as Element;

        // @ts-expect-error (non strict)
        if (!isAncestor(menuElement, target) && !isAncestor(target, menuElement)) {
          return;
        }

        if (target.hasAttribute('data-action')) {
          (target as HTMLButtonElement).blur();
        }

        const highlightable = Array.from(
          containerRef.current.querySelectorAll('[data-highlightable=true]')
        );
        const currentIndex = highlightable.findIndex(
          (el) =>
            el.getAttribute('data-item-id') === highlightedRef.current?.itemId &&
            el.getAttribute('data-ref-id') === highlightedRef.current?.refId
        );
        const nextIndex = cycle(highlightable, currentIndex, isArrowUp ? -1 : 1);
        const didRunAround = isArrowUp ? nextIndex === highlightable.length - 1 : nextIndex === 0;
        highlightElement(highlightable[nextIndex], didRunAround);

        if (highlightable[nextIndex].getAttribute('data-nodetype') === 'component') {
          // @ts-expect-error (non strict)
          const { itemId, refId } = highlightedRef.current;
          const item = api.resolveStory(itemId, refId === 'storybook_internal' ? undefined : refId);
          // @ts-expect-error (non strict)
          if (item.type === 'component') {
            api.emit(PRELOAD_ENTRIES, {
              // @ts-expect-error (non strict)
              ids: [item.children[0]],
              options: { target: refId },
            });
          }
        }
      });
    };

    document.addEventListener('keydown', navigateTree);
    return () => document.removeEventListener('keydown', navigateTree);
  }, [isLoading, isBrowsing, highlightedRef, highlightElement]);

  // @ts-expect-error (non strict)
  return [highlighted, updateHighlighted, highlightedRef];
};
