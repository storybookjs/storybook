import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PRELOAD_ENTRIES } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import { useStorybookApi } from 'storybook/manager-api';

import { cycle, scrollIntoView } from '../../utils/tree';
import type { Highlight, Selection } from './types';

const { document } = global;

export interface HighlightedProps {
  containerRef: RefObject<HTMLElement | null>;
  isLoading: boolean;
  isBrowsing: boolean;
  selected: Selection;
}

const fromSelection = (selection: Selection): Highlight =>
  selection ? { itemId: selection.storyId, refId: selection.refId } : null;

const scrollToSelector = (
  selector: string,
  options: {
    containerRef?: RefObject<Element | null>;
    center?: boolean;
    attempts?: number;
    delay?: number;
  } = {},
  _attempt = 1
) => {
  const { containerRef, center = false, attempts = 3, delay = 500 } = options;
  const element = (containerRef ? containerRef.current : document)?.querySelector(selector);
  if (element) {
    scrollIntoView(element, center);
  } else if (_attempt <= attempts) {
    setTimeout(scrollToSelector, delay, selector, options, _attempt + 1);
  }
};

export const useHighlighted = ({
  containerRef,
  isLoading,
  isBrowsing,
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
  const isManuallyNavigatingRef = useRef(false);

  const updateHighlighted = useCallback(
    (highlight: Highlight) => {
      highlightedRef.current = highlight;
      setHighlighted(highlight);
    },
    [highlightedRef]
  );

  const highlightElement = useCallback(
    (element: Element, center = false) => {
      const itemId = element.getAttribute('data-item-id');
      const refId = element.getAttribute('data-ref-id');

      if (!itemId || !refId) {
        return;
      }
      isManuallyNavigatingRef.current = true;
      updateHighlighted({ itemId, refId });
      scrollIntoView(element, center);

      // Set DOM focus for visual feedback (important for screen readers like NVDA)
      if (element instanceof HTMLElement) {
        element.focus({ preventScroll: true });
      }
    },
    [updateHighlighted]
  );

  useEffect(() => {
    const highlight = fromSelection(selected);
    if (!isManuallyNavigatingRef.current) {
      updateHighlighted(highlight);
      if (highlight) {
        scrollToSelector(`[data-item-id="${highlight.itemId}"][data-ref-id="${highlight.refId}"]`, {
          containerRef,
          center: true,
        });
      }
    }
    isManuallyNavigatingRef.current = false;
  }, [containerRef, selected, updateHighlighted]);

  // Sync highlight with DOM focus (works with screen readers like NVDA)
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Element;
      const sidebarItem = target.closest('[data-item-id][data-ref-id]');
      if (!sidebarItem) {
        return;
      }

      const itemId = sidebarItem.getAttribute('data-item-id');
      const refId = sidebarItem.getAttribute('data-ref-id');

      if (itemId && refId) {
        isManuallyNavigatingRef.current = true;
        updateHighlighted({ itemId, refId });

        const nodetype = sidebarItem.getAttribute('data-nodetype');
        if (nodetype === 'component') {
          const item = api.resolveStory(itemId, refId === 'storybook_internal' ? undefined : refId);
          if (item?.type === 'component') {
            api.emit(PRELOAD_ENTRIES, {
              ids: [item.children[0]],
              options: { target: refId },
            });
          }
        }
      }
    };

    // Use focusin (bubbles) instead of focus (doesn't bubble)
    containerRef.current.addEventListener('focusin', handleFocusIn);

    return () => {
      containerRef.current?.removeEventListener('focusin', handleFocusIn);
    };
  }, [api, containerRef, updateHighlighted]);

  // Sync DOM focus when highlighted changes programmatically
  useEffect(() => {
    if (!highlightedRef.current || !containerRef.current || isManuallyNavigatingRef.current) {
      return;
    }

    const { itemId, refId } = highlightedRef.current;
    const element = containerRef.current.querySelector(
      `[data-item-id="${itemId}"][data-ref-id="${refId}"]`
    );

    if (element instanceof HTMLElement && document.activeElement !== element) {
      element.focus({ preventScroll: true });
    }
  }, [highlighted, containerRef, highlightedRef]);

  // Arrow Up/Down navigation: Handle on focused element, not document
  // This works with NVDA because events on focused elements are not intercepted
  useEffect(() => {
    if (!containerRef.current || isLoading || !isBrowsing) {
      return;
    }

    const container = containerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element;
      const focusedItem = target.closest('[data-highlightable="true"]');

      if (!focusedItem) {
        return;
      }

      const isArrowUp = event.key === 'ArrowUp';
      const isArrowDown = event.key === 'ArrowDown';

      if (!(isArrowUp || isArrowDown)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const highlightable = Array.from(container.querySelectorAll('[data-highlightable="true"]'));
      const currentIndex = highlightable.findIndex(
        (el) =>
          el.getAttribute('data-item-id') === highlightedRef.current?.itemId &&
          el.getAttribute('data-ref-id') === highlightedRef.current?.refId
      );

      const nextIndex = cycle(highlightable, currentIndex, isArrowUp ? -1 : 1);
      const didRunAround = isArrowUp ? nextIndex === highlightable.length - 1 : nextIndex === 0;

      if (highlightable[nextIndex]) {
        highlightElement(highlightable[nextIndex], didRunAround);

        if (highlightable[nextIndex].getAttribute('data-nodetype') === 'component') {
          const itemId = highlightable[nextIndex].getAttribute('data-item-id');
          const refId = highlightable[nextIndex].getAttribute('data-ref-id');
          if (itemId && refId) {
            const item = api.resolveStory(
              itemId,
              refId === 'storybook_internal' ? undefined : refId
            );
            if (item?.type === 'component') {
              api.emit(PRELOAD_ENTRIES, {
                ids: [item.children[0]],
                options: { target: refId },
              });
            }
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown, true);

    return () => {
      container.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [api, containerRef, isLoading, isBrowsing, highlightedRef, highlightElement]); // @ts-expect-error (non strict)
  return [highlighted, updateHighlighted, highlightedRef];
};
