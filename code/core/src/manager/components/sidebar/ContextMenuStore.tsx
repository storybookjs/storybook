import { createContext } from 'react';

import type { ContextMenuTrigger } from './ContextMenu.tsx';

/** The row whose context menu is open, and how the user opened it. */
export interface OpenContextMenu {
  itemId: string;
  openedBy: ContextMenuTrigger;
}

/**
 * Minimal external store for the open context menu. As a react-aria collection dependency, a
 * change of the open menu invalidates the node cache and re-renders every row in the tree, which
 * takes seconds with thousands of rows. Rows subscribe to this store with useSyncExternalStore
 * instead, so only the row that opens or closes its menu re-renders.
 */
export interface ContextMenuStore {
  getState: () => OpenContextMenu | null;
  setState: (state: OpenContextMenu | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createContextMenuStore = (): ContextMenuStore => {
  let state: OpenContextMenu | null = null;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next: OpenContextMenu | null) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** Default store so TreeNode can render outside a Tree (stories, tests). */
export const ContextMenuStoreContext = createContext<ContextMenuStore>(createContextMenuStore());
