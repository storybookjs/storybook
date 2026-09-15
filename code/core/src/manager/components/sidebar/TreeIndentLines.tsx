import React, { useCallback, useEffect, useRef, type RefObject } from 'react';

import { transparentize } from 'polished';
import { styled } from 'storybook/theming';

import {
  TREE_CONTENT_INSET,
  TREE_INDENT_STEP,
  TREE_ROW_HEIGHT,
  type FlatRows,
} from './treeGeometry.ts';

/**
 * The tree sets this custom property to 1 while the pointer is over the tree, or while a row holds
 * keyboard focus. The grid and accent lines follow it, and the selection line ignores it.
 */
export const INDENT_LINE_OPACITY_VAR = '--indent-line-opacity';

/**
 * Distance in px from the tree's left edge to an indent level's line, just left of the icons. The
 * sticky rows draw their own line segments at the same positions.
 */
export function indentLineX(level: number): number {
  return level * TREE_INDENT_STEP - TREE_CONTENT_INSET;
}

/**
 * One SVG layer carries every indent line of the scrolling rows. It lives in the scrolled content,
 * so the lines move with the rows on the compositor and no scroll handler is involved; the sticky
 * rows are opaque and draw their own segments on top. One layer also keeps the DOM small — three
 * paths, not one element per indent level per row — and a single path cannot land on different
 * device pixels row by row at fractional zoom.
 */
const IndentLineLayer = styled.svg(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
  // Above the rows and their hover fills, below the sticky rows (zIndex 3).
  zIndex: 2,
  pointerEvents: 'none',
  shapeRendering: 'crispEdges',
  '& path': {
    strokeWidth: 1,
    fill: 'none',
    stroke: theme.appBorderColor,
  },
  // The grid marks the shape of the tree, and the accent marks one row inside it. Both appear
  // only while the user points at the tree or moves through it with the keyboard.
  '& path[data-indent-lines="grid"], & path[data-indent-lines="accent"]': {
    opacity: `var(${INDENT_LINE_OPACITY_VAR}, 0)`,
    transition: 'opacity 150ms ease',
  },
  '& path[data-indent-lines="accent"]': {
    stroke: transparentize(0.52, theme.color.secondary),
  },
}));

/** The row under the pointer. A sticky copy draws its own accent, so it is skipped here. */
export interface HoveredRow {
  id: string;
  sticky: boolean;
}

interface IndentLinesOptions {
  /** Geometry of the visible rows. */
  rows: FlatRows;
  /** The row under the pointer, or null. */
  hoveredRowRef: RefObject<HoveredRow | null>;
  /** The row that holds keyboard focus, or null. A pointer press does not set it. */
  keyboardFocusedItemId: string | null;
  /** Parent of the selected story. Its children share the selection line. */
  selectedParentId: string | null;
}

// The half pixel keeps the 1px stroke on the device pixel grid.
const line = (parts: string[], level: number, top: number, bottom: number) => {
  parts.push(`M${indentLineX(level) + 0.5} ${top}V${bottom}`);
};

/**
 * Draw the indent lines of the tree, and return the layer to render.
 *
 * Every line is drawn in the tree's own coordinates over the full tree height, so nothing here
 * depends on the scroll offset: the grid and selection paths change only with the row geometry,
 * and the accent path only when the hovered or focused row changes (call `redrawAccent` then).
 */
export function useIndentLines({
  rows,
  hoveredRowRef,
  keyboardFocusedItemId,
  selectedParentId,
}: IndentLinesOptions) {
  const gridPathRef = useRef<SVGPathElement>(null);
  const accentPathRef = useRef<SVGPathElement>(null);
  const selectionPathRef = useRef<SVGPathElement>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const keyboardFocusedItemIdRef = useRef(keyboardFocusedItemId);
  keyboardFocusedItemIdRef.current = keyboardFocusedItemId;

  // One segment per branch: from the top of its first child to the bottom of its subtree. The
  // union of these segments equals a per-row drawing, because every row in a subtree is at least
  // one level deeper than the branch, and section gaps only occur between top-level sections.
  useEffect(() => {
    const { ids, offsets, subtreeBottoms, depths } = rows;
    const grid: string[] = [];
    for (let i = 0; i < ids.length; i += 1) {
      const rowBottom = offsets[i] + TREE_ROW_HEIGHT;
      const subtreeBottom = subtreeBottoms.get(ids[i]) ?? 0;
      if (subtreeBottom > rowBottom) {
        line(grid, depths[i] + 1, rowBottom, subtreeBottom);
      }
    }
    gridPathRef.current?.setAttribute('d', grid.join(''));
  }, [rows]);

  // Every line of the hovered and keyboard-focused rows, within their own band. A row covered by
  // the sticky stack is painted over by its opaque backing, and a hovered sticky copy colors its
  // own segments, so neither needs handling here.
  const redrawAccent = useCallback(() => {
    const { offsets, depths, indexById } = rowsRef.current;
    const accent: string[] = [];
    const accentRow = (id: string) => {
      const rowIndex = indexById.get(id);
      if (rowIndex === undefined) {
        return;
      }
      const top = offsets[rowIndex];
      for (let level = 1; level <= depths[rowIndex]; level += 1) {
        line(accent, level, top, top + TREE_ROW_HEIGHT);
      }
    };
    const hovered = hoveredRowRef.current;
    if (hovered && !hovered.sticky) {
      accentRow(hovered.id);
    }
    const focused = keyboardFocusedItemIdRef.current;
    if (focused && focused !== hovered?.id) {
      accentRow(focused);
    }
    accentPathRef.current?.setAttribute('d', accent.join(''));
  }, [hoveredRowRef]);

  // The children of the selected story's parent keep one line at their own level, so the user
  // can see where the selection sits even when the rest of the grid is hidden. The line runs
  // from the first child down to the bottom of the last child's subtree.
  useEffect(() => {
    const { offsets, depths, indexById, subtreeBottoms } = rows;
    const selection: string[] = [];
    const parentIndex = selectedParentId === null ? undefined : indexById.get(selectedParentId);
    const firstChildIndex = parentIndex === undefined ? undefined : parentIndex + 1;
    if (
      selectedParentId !== null &&
      parentIndex !== undefined &&
      firstChildIndex !== undefined &&
      depths[firstChildIndex] === depths[parentIndex] + 1
    ) {
      line(
        selection,
        depths[firstChildIndex],
        offsets[firstChildIndex],
        subtreeBottoms.get(selectedParentId) ?? 0
      );
    }
    selectionPathRef.current?.setAttribute('d', selection.join(''));
  }, [rows, selectedParentId]);

  // Keyboard focus moves without a pointer event.
  useEffect(redrawAccent, [redrawAccent, keyboardFocusedItemId, rows]);

  const layer = (
    <IndentLineLayer aria-hidden="true" data-testid="indent-lines">
      <path ref={gridPathRef} data-indent-lines="grid" />
      <path ref={accentPathRef} data-indent-lines="accent" />
      <path ref={selectionPathRef} data-indent-lines="selection" />
    </IndentLineLayer>
  );

  return { layer, redrawAccent };
}
