import { createContext } from 'react';

import type { ContextMenuEntryMethod } from './ContextMenu.tsx';

/** Per-row UI state that changes with user interaction but must not re-render the whole tree. */
export interface RowUiState {
  /** Parent id of the selected story; rows sharing it show the selection trace accent. */
  selectedParentId: string | null;
  /** Which row's context menu is open, and how it was opened. */
  contextMenu: { itemId: string; entryMethod: ContextMenuEntryMethod } | null;
}

/**
 * Minimal external store. Selection and context-menu changes used to be react-aria collection
 * dependencies, which invalidated the node cache and re-rendered every row in the tree (seconds
 * with thousands of rows). Rows subscribe here instead (useSyncExternalStore) and only the rows
 * whose derived state actually changed re-render.
 */
export interface RowUiStore {
  getState: () => RowUiState;
  setState: (state: RowUiState) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createRowUiStore = (): RowUiStore => {
  let state: RowUiState = { selectedParentId: null, contextMenu: null };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next: RowUiState) => {
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
export const RowUiContext = createContext<RowUiStore>(createRowUiStore());
