import { useCallback, useEffect, useMemo } from 'react';

import {
  internal_checklistStore as checklistStore,
  internal_universalChecklistStore as universalChecklistStore,
} from '#manager-stores';
import {
  experimental_useUniversalStore,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import type { ChecklistData } from '../../settings/Checklist/checklistData';
import { checklistData } from '../../settings/Checklist/checklistData';

type ChecklistItem = ChecklistData['sections'][number]['items'][number];

const subscriptions = new Map<string, void | (() => void)>();

export const useChecklist = () => {
  const api = useStorybookApi();
  const { index } = useStorybookState();
  const [checklistState] = experimental_useUniversalStore(universalChecklistStore);
  const { loaded, muted, accepted, done, skipped } = checklistState;

  const isOpen = useCallback(
    ({ id, available }: ChecklistItem) =>
      !accepted.includes(id) &&
      !done.includes(id) &&
      !skipped.includes(id) &&
      (available?.({ api }) ?? true),
    [api, accepted, done, skipped]
  );

  const isReady = useCallback(
    (item: ChecklistItem): boolean =>
      isOpen(item) &&
      !(Array.isArray(muted) && muted.includes(item.id)) &&
      !item.after?.some((id) => !accepted.includes(id) && !done.includes(id)),
    [isOpen, accepted, done, muted]
  );

  const allItems = useMemo<ChecklistItem[]>(
    () => checklistData.sections.flatMap(({ items }) => items),
    []
  );

  useEffect(() => {
    if (!index || !loaded) {
      return;
    }

    for (const item of allItems) {
      if (!item.subscribe) {
        continue;
      }

      const open = isOpen(item);
      const subscribed = subscriptions.has(item.id);
      if (open && !subscribed) {
        subscriptions.set(
          item.id,
          item.subscribe({
            api,
            index,
            item,
            accept: () => checklistStore.accept(item.id),
            done: () => checklistStore.done(item.id),
            skip: () => checklistStore.skip(item.id),
          })
        );
      } else if (subscribed && !open) {
        const unsubscribe = subscriptions.get(item.id);
        subscriptions.delete(item.id);
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }
    }
  }, [api, index, loaded, allItems, isOpen]);

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
  }, [allItems, isOpen, isReady]);

  return {
    ...checklistData,
    ...checklistStore,
    ...checklistState,
    allItems,
    nextItems,
    openItems,
    progress,
  };
};
