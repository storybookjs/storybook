import { createContext, useContext, useSyncExternalStore } from 'react';

import type { StatusValue, StoryId } from 'storybook/internal/types';

/**
 * The two status slots a tree row shows. `change` is already masked by the modified filter, so a
 * row reads the value it displays rather than deciding again whether to display it.
 */
export interface RowStatus {
  change: StatusValue;
  test: StatusValue;
}

/** The statuses of a row that has none. One shared object, so such a row keeps one snapshot. */
const NO_STATUS: RowStatus = {
  change: 'status-value:unknown',
  test: 'status-value:unknown',
};

/**
 * Minimal external store for the row statuses, following ContextMenuStore. As a react-aria
 * collection dependency, or as a context value, one row's status change would re-render every row
 * in the tree. Rows subscribe here instead, and `setState` keeps the previous object for a row
 * whose own two values are unchanged, so the rows that did not change keep their snapshot and
 * `useSyncExternalStore` leaves them alone.
 */
export interface StatusStore {
  getRowStatus: (itemId: StoryId) => RowStatus;
  setState: (next: Record<StoryId, RowStatus>) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createStatusStore = (initial: Record<StoryId, RowStatus> = {}): StatusStore => {
  let state: Record<StoryId, RowStatus> = initial;
  const listeners = new Set<() => void>();
  return {
    getRowStatus: (itemId: StoryId) => state[itemId] ?? NO_STATUS,
    setState: (next: Record<StoryId, RowStatus>) => {
      const merged: Record<StoryId, RowStatus> = {};
      for (const [itemId, value] of Object.entries(next)) {
        const previous = state[itemId];
        merged[itemId] =
          previous && previous.change === value.change && previous.test === value.test
            ? previous
            : value;
      }
      state = merged;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** Default store so TreeNode can render outside a Tree (stories, tests). */
export const StatusStoreContext = createContext<StatusStore>(createStatusStore());

/** The statuses this row shows. */
export function useRowStatus(itemId: StoryId): RowStatus {
  const store = useContext(StatusStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getRowStatus(itemId));
}
