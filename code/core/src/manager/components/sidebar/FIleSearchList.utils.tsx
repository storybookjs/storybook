import { useEffect } from 'react';
import { flushSync } from 'react-dom';

import type { Virtualizer } from '@tanstack/react-virtual';

interface UseArrowKeyNavigationProps {
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  parentRef: React.MutableRefObject<HTMLDivElement>;
  selectedItem: number | null;
}

/**
 * Hook to navigate through the list of items and subitems using the arrow keys
 */
export const useArrowKeyNavigation = ({
  parentRef,
  rowVirtualizer,
  selectedItem,
}: UseArrowKeyNavigationProps) => {
  useEffect(() => {
    const handleArrowKeys = (event: KeyboardEvent) => {
      if (!parentRef.current) {
        return;
      }

      const maxIndex = rowVirtualizer.options.count;
      const activeElement = document.activeElement;
      // @ts-expect-error (non strict)
      const rowIndex = parseInt(activeElement.getAttribute('data-index') || '-1', 10);
      // @ts-expect-error (non strict)
      const isActiveElementInput = activeElement.tagName === 'INPUT';

      const getFirstElement = () =>
        document.querySelector('[data-index="0"]') as HTMLElement | null;
      const getLastElement = () =>
        document.querySelector(`[data-index="${maxIndex - 1}"]`) as HTMLElement | null;

      if (event.code === 'ArrowDown' && activeElement) {
        event.stopPropagation();

        // If the search input is focused, focus the first element
        if (isActiveElementInput) {
          getFirstElement()?.focus();
          return;
        }

        // if the last element is focused, focus the first element
        if (rowIndex === maxIndex - 1) {
          flushSync(() => {
            rowVirtualizer.scrollToIndex(0, { align: 'start' });
          });
          setTimeout(() => {
            getFirstElement()?.focus();
          }, 100);
          return;
        }

        // if the focus is on an selected element, focus the first element in the sublist
        if (selectedItem === rowIndex) {
          const firstSubListItem = document.querySelector(
            `[data-index-position="${selectedItem}_first"]`
          ) as HTMLElement;
          firstSubListItem?.focus();
          return;
        }

        // if the focus is on the last element on a sublist, focus the next parent list element
        if (selectedItem !== null) {
          const isLastElementSelected = activeElement
            .getAttribute('data-index-position')
            ?.includes('last');
          if (isLastElementSelected) {
            const nextElement = document.querySelector(
              `[data-index="${selectedItem + 1}"]`
            ) as HTMLElement;
            nextElement?.focus();
            return;
          }
        }

        const nextElement = activeElement.nextElementSibling as HTMLElement;
        nextElement?.focus();
      }

      if (event.code === 'ArrowUp' && activeElement) {
        if (isActiveElementInput) {
          flushSync(() => {
            rowVirtualizer.scrollToIndex(maxIndex - 1, { align: 'start' });
          });
          setTimeout(() => {
            getLastElement()?.focus();
          }, 100);
          return;
        }

        // if the focus is on the first element on a sublist, focus the previous parent list element
        if (selectedItem !== null) {
          const isLastElementSelected = activeElement
            .getAttribute('data-index-position')
            ?.includes('first');
          if (isLastElementSelected) {
            const prevElement = document.querySelector(
              `[data-index="${selectedItem}"]`
            ) as HTMLElement;
            prevElement?.focus();
            return;
          }
        }

        const previousElement = activeElement.previousElementSibling as HTMLElement;
        previousElement?.focus();
      }
    };
    // listener for arrow keys to select the next/previous element by using the current active element as base
    document.addEventListener('keydown', handleArrowKeys, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleArrowKeys, { capture: true });
    };
  }, [rowVirtualizer, selectedItem, parentRef]);
};
