import React, { createContext, useContext, useSyncExternalStore } from 'react';

import { styled } from 'storybook/theming';

import { TREE_CONTENT_INSET, TREE_INDENT_STEP } from './treeGeometry.ts';

/**
 * The tree sets this custom property to 1 while the pointer is over the tree, or while a row holds
 * keyboard focus. The indent lines follow it, and the selection line ignores it.
 */
export const INDENT_LINE_OPACITY_VAR = '--indent-line-opacity';

/**
 * Distance in px from the tree's left edge to an indent level's line, just left of the icons. The
 * rows, their sticky copies, and the sticky shadow's mask all derive from this.
 */
export function indentLineX(level: number): number {
  return level * TREE_INDENT_STEP - TREE_CONTENT_INSET;
}

const IndentLine = styled.span(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 1,
  pointerEvents: 'none',
  backgroundColor: theme.appBorderColor,
  opacity: `var(${INDENT_LINE_OPACITY_VAR}, 0)`,
  transition: 'opacity 150ms ease',
  // The rows around the selected story keep their shared line visible while the rest are hidden,
  // so the user can see where the selection sits.
  '&[data-selection-line]': {
    opacity: 1,
  },
}));

/**
 * The indent lines of one row, levels 1 to `level`. Each row and each sticky copy carries its
 * own, so the lines scroll and stick on the compositor with the row that owns them. The host row
 * colors them on hover and keyboard focus through `[data-indent-line]`, and `selectionLevel`
 * marks the one line this row shares with the selected story's siblings.
 */
export function IndentLines({
  level,
  selectionLevel = 0,
}: {
  level: number;
  selectionLevel?: number;
}) {
  return (
    <>
      {Array.from({ length: level }, (_, index) => (
        <IndentLine
          key={index}
          data-indent-line
          data-selection-line={index + 1 === selectionLevel || undefined}
          aria-hidden="true"
          style={{ left: indentLineX(index + 1) }}
        />
      ))}
    </>
  );
}

/** The rows around the selected story, and the indent level of the line they share. */
export interface SelectionLine {
  level: number;
  rowIds: ReadonlySet<string>;
}

/**
 * Minimal external store for the selection line, following ContextMenuStore: as a react-aria
 * collection dependency or a row prop, a selection change would re-render every row in the tree.
 * Rows subscribe here instead, so only the rows entering or leaving the selection re-render.
 */
export interface SelectionLineStore {
  getState: () => SelectionLine | null;
  setState: (state: SelectionLine | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createSelectionLineStore = (): SelectionLineStore => {
  let state: SelectionLine | null = null;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next: SelectionLine | null) => {
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
export const SelectionLineStoreContext = createContext<SelectionLineStore>(
  createSelectionLineStore()
);

/** The level of the selection line this row carries, or 0. */
export function useSelectionLineLevel(itemId: string): number {
  const store = useContext(SelectionLineStoreContext);
  return useSyncExternalStore(store.subscribe, () => {
    const state = store.getState();
    return state && state.rowIds.has(itemId) ? state.level : 0;
  });
}
