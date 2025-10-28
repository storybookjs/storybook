import { useCallback, useMemo } from 'react';

import { checklistStore, universalChecklistStore } from '#manager-stores';
import { experimental_useUniversalStore } from 'storybook/manager-api';

import { checklistData } from '../../settings/Checklist/checklistData';

export type ChecklistItem = (typeof checklistData)['sections'][number]['items'][number];

const allItems: ChecklistItem[] = checklistData.sections.flatMap(({ items }) => items);

export const useChecklist = () => {
  const [state] = experimental_useUniversalStore(universalChecklistStore);
  const { muted, completed, skipped } = state;

  const isOpen = useCallback(
    ({ id }: ChecklistItem): boolean => !completed.includes(id) && !skipped.includes(id),
    [completed, skipped]
  );

  const isReady = useCallback(
    (item: ChecklistItem): boolean =>
      isOpen(item) &&
      !(Array.isArray(muted) && muted.includes(item.id)) &&
      !item.after?.some((id) => !completed.includes(id)),
    [isOpen, completed, muted]
  );

  const { openItems, nextItems, progress } = useMemo(() => {
    const openItems = allItems.filter(isOpen);
    const progress = Math.round(((allItems.length - openItems.length) / allItems.length) * 100);

    // Collect a list of the next 3 tasks that are ready.
    // Tasks are pulled from each section in a round-robin fashion,
    // so that users can choose their own adventure.
    const nextItems = checklistData.sections
      .flatMap(({ items }, sectionIndex) =>
        items.filter(isReady).map((item, itemIndex) => ({ item, itemIndex, sectionIndex }))
      )
      .sort((a, b) => a.itemIndex - b.itemIndex)
      .slice(0, 3)
      .sort((a, b) => a.sectionIndex - b.sectionIndex)
      .flatMap(({ item }) => (item ? [item] : []));

    return { openItems, nextItems, progress };
  }, [isOpen, isReady]);

  return {
    ...checklistData,
    ...checklistStore,
    ...state,
    allItems,
    nextItems,
    openItems,
    progress,
  };
};
