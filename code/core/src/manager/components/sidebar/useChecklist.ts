import { useEffect, useMemo, useState } from 'react';

import type { API_IndexHash } from 'storybook/internal/types';

import {
  internal_checklistStore as checklistStore,
  internal_universalChecklistStore as universalChecklistStore,
} from '#manager-stores';
import { throttle } from 'es-toolkit/function';
import {
  type API,
  experimental_useUniversalStore,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import type { ChecklistData } from '../../settings/Checklist/checklistData';
import { checklistData } from '../../settings/Checklist/checklistData';

type RawItemWithSection = ChecklistData['sections'][number]['items'][number] & {
  itemIndex: number;
  sectionId: string;
  sectionIndex: number;
  sectionTitle: string;
};

export type ChecklistItem = RawItemWithSection & {
  isAvailable: boolean;
  isOpen: boolean;
  isLockedBy: string[];
  isImmutable: boolean;
  isReady: boolean;
  isCompleted: boolean;
  isAccepted: boolean;
  isDone: boolean;
  isSkipped: boolean;
  isMuted: boolean;
};

const subscriptions = new Map<string, void | (() => void)>();

const useStoryIndex = () => {
  const state = useStorybookState();
  const [index, setIndex] = useState<API_IndexHash | undefined>(() => state.index);
  const updateIndex = useMemo(() => throttle(setIndex, 500), []);

  useEffect(() => updateIndex(state.index), [state.index, updateIndex]);
  useEffect(() => () => updateIndex.cancel?.(), [updateIndex]);

  return index;
};

const checkAvailable = (
  item: RawItemWithSection,
  context: { api: API; index: API_IndexHash | undefined; item: RawItemWithSection },
  itemsById: Record<RawItemWithSection['id'], RawItemWithSection>
) => {
  if (item.available && !item.available(context)) {
    return false;
  }
  for (const afterId of item.after ?? []) {
    if (itemsById[afterId] && !checkAvailable(itemsById[afterId], context, itemsById)) {
      return false;
    }
  }
  return true;
};

const checkSkipped = (
  item: RawItemWithSection,
  itemsById: Record<RawItemWithSection['id'], RawItemWithSection>,
  skipped: string[]
) => {
  const isSkipped = skipped.includes(item.id);
  if (isSkipped) {
    return true;
  }
  for (const afterId of item.after ?? []) {
    if (itemsById[afterId] && checkSkipped(itemsById[afterId], itemsById, skipped)) {
      return true;
    }
  }
  return false;
};

export const useChecklist = () => {
  const api = useStorybookApi();
  const index = useStoryIndex();
  const [checklistState] = experimental_useUniversalStore(universalChecklistStore);
  const { loaded, muted, accepted, done, skipped } = checklistState;

  const itemsById = useMemo<Record<RawItemWithSection['id'], RawItemWithSection>>(() => {
    return Object.fromEntries(
      checklistData.sections.flatMap(
        ({ items, id: sectionId, title: sectionTitle }, sectionIndex) =>
          items.map(({ id, ...item }, itemIndex) => {
            return [id, { id, itemIndex, sectionId, sectionIndex, sectionTitle, ...item }];
          })
      )
    );
  }, []);

  const allItems = useMemo(() => {
    return Object.values(itemsById).map<ChecklistItem>((item) => {
      const isAccepted = accepted.includes(item.id);
      const isDone = done.includes(item.id);
      const isCompleted = isAccepted || isDone;
      const isSkipped = checkSkipped(item, itemsById, skipped);
      const isMuted = Array.isArray(muted) ? muted.includes(item.id) : !!muted;

      const isAvailable = isCompleted
        ? item.afterCompletion !== 'unavailable'
        : checkAvailable(item, { api, index, item }, itemsById);
      const isOpen = !isAccepted && !isDone && !isSkipped && isAvailable;
      const isLockedBy =
        item.after?.filter((id) => !accepted.includes(id) && !done.includes(id)) ?? [];
      const isImmutable = isCompleted && item.afterCompletion === 'immutable';
      const isReady = isOpen && !isMuted && isLockedBy.length === 0;

      return {
        ...item,
        isAvailable,
        isOpen,
        isLockedBy,
        isImmutable,
        isReady,
        isCompleted,
        isAccepted,
        isDone,
        isSkipped,
        isMuted,
      };
    });
  }, [itemsById, accepted, done, skipped, muted, api, index]);

  const itemCollections = useMemo(() => {
    const availableItems = allItems.filter((item) => item.isAvailable);
    const openItems = availableItems.filter((item) => item.isOpen);
    const readyItems = openItems.filter((item) => item.isReady);

    // Collect a list of the next 3 tasks that are ready.
    // Tasks are pulled from each section in a round-robin fashion,
    // so that users can choose their own adventure.
    const nextItems = Object.values(
      readyItems.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
        // Reset itemIndex to only include ready items.
        acc[item.sectionId] ??= [];
        acc[item.sectionId].push({ ...item, itemIndex: acc[item.sectionId].length });
        return acc;
      }, {})
    )
      .flat()
      .sort((a, b) => a.itemIndex - b.itemIndex)
      .slice(0, 3)
      .sort((a, b) => a.sectionIndex - b.sectionIndex);

    const progress = availableItems.length
      ? Math.round(((availableItems.length - openItems.length) / availableItems.length) * 100)
      : 100;

    return { availableItems, openItems, readyItems, nextItems, progress };
  }, [allItems]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    for (const item of allItems) {
      if (!item.subscribe) {
        continue;
      }

      const subscribed = subscriptions.has(item.id);
      if (item.isOpen && !subscribed) {
        subscriptions.set(
          item.id,
          item.subscribe({
            api,
            item,
            accept: () => checklistStore.accept(item.id),
            done: () => checklistStore.done(item.id),
            skip: () => checklistStore.skip(item.id),
          })
        );
      } else if (subscribed && !item.isOpen) {
        const unsubscribe = subscriptions.get(item.id);
        subscriptions.delete(item.id);
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }
    }
  }, [api, loaded, allItems]);

  return {
    allItems,
    ...itemCollections,
    ...checklistStore,
    ...checklistState,
  };
};
