import React, { useCallback, useEffect, useRef, type RefObject } from 'react';

import { transparentize } from 'polished';
import { styled } from 'storybook/theming';

import {
  TREE_CONTENT_INSET,
  TREE_INDENT_STEP,
  TREE_ROW_HEIGHT,
  findFirstRowBelow,
  scrollTopWithin,
  type FlatRows,
} from './treeGeometry.ts';

/**
 * The tree sets this custom property to 1 while the pointer is over the tree, or while a row holds
 * keyboard focus. The grid and accent lines follow it, and the selection line ignores it.
 */
export const INDENT_LINE_OPACITY_VAR = '--indent-line-opacity';

/**
 * One SVG layer above the sticky rows carries every indent line of the tree. A per-row line would
 * have to stitch itself across the sticky rows and the fade below them, and would drift from the
 * rows it marks at some zoom levels. One layer also keeps the DOM small: the tree draws three
 * paths, not one element per indent level per row.
 */
const IndentLineLayer = styled.svg(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
  // Above the shadow of the sticky overlay.
  zIndex: 4,
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

/** The row under the pointer. A sticky copy and the row it covers need different geometry. */
export interface HoveredRow {
  id: string;
  sticky: boolean;
}

interface IndentLinesOptions {
  /** The sidebar's one scroll area. */
  scrollerRef: RefObject<HTMLElement | null> | null;
  /** The tree's own box, which the lines are drawn over. */
  wrapperRef: RefObject<HTMLElement | null>;
  /** Geometry of the visible rows. */
  rowsRef: RefObject<FlatRows>;
  /** Ids of the sticky rows, from the top slot down. */
  stickyIdsRef: RefObject<string[]>;
  /** The row under the pointer, or null. */
  hoveredRowRef: RefObject<HoveredRow | null>;
  /** The row that holds keyboard focus, or null. A pointer press does not set it. */
  keyboardFocusedItemId: string | null;
  /** Parent of the selected story. Its children share the selection line. */
  selectedParentId: string | null;
}

/**
 * Draw the indent lines of the tree, and return the layer to render.
 *
 * The lines are written straight to the SVG paths, so a scroll or a pointer move never re-renders
 * the tree. Call `redraw` whenever the scroll offset, the sticky rows or the row geometry change.
 */
export function useIndentLines({
  scrollerRef,
  wrapperRef,
  rowsRef,
  stickyIdsRef,
  hoveredRowRef,
  keyboardFocusedItemId,
  selectedParentId,
}: IndentLinesOptions) {
  const gridPathRef = useRef<SVGPathElement>(null);
  const accentPathRef = useRef<SVGPathElement>(null);
  const selectionPathRef = useRef<SVGPathElement>(null);
  const keyboardFocusedItemIdRef = useRef(keyboardFocusedItemId);
  keyboardFocusedItemIdRef.current = keyboardFocusedItemId;
  const selectedParentIdRef = useRef(selectedParentId);
  selectedParentIdRef.current = selectedParentId;

  const redraw = useCallback(() => {
    const scroller = scrollerRef?.current;
    const wrapper = wrapperRef.current;
    const rows = rowsRef.current;
    if (!scroller || !wrapper || !rows) {
      return;
    }
    const { offsets, depths, indexById, subtreeBottoms } = rows;
    const stickyIds = stickyIdsRef.current ?? [];
    // Every y below is a distance from the top of this tree, because the layer covers the tree
    // rather than the scroll area. `scrollTop` is how far this tree has scrolled past the top of
    // the visible area, and it is negative while the tree still starts below that edge.
    const scrollTop = scrollTopWithin(scroller, wrapper);
    const viewportHeight = scroller.clientHeight;
    const stickyHeight = stickyIds.length * TREE_ROW_HEIGHT;
    const stickyBottom = scrollTop + stickyHeight;

    // A line sits at the start of its own indent level, just left of the icons. The half pixel
    // keeps the 1px stroke on the device pixel grid.
    const line = (parts: string[], level: number, top: number, bottom: number) => {
      const x = level * TREE_INDENT_STEP - TREE_CONTENT_INSET + 0.5;
      parts.push(`M${x} ${Math.round(top)}V${Math.round(bottom)}`);
    };

    // Every line of one row. Segments of rows above and below each other abut, so they read as one
    // continuous line without any merge step.
    const rowLines = (parts: string[], rowIndex: number, top: number, bottom: number) => {
      for (let level = 1; level <= depths[rowIndex]; level += 1) {
        line(parts, level, top, bottom);
      }
    };

    const grid: string[] = [];
    stickyIds.forEach((id, slot) => {
      const rowIndex = indexById.get(id);
      if (rowIndex !== undefined) {
        const top = scrollTop + slot * TREE_ROW_HEIGHT;
        rowLines(grid, rowIndex, top, top + TREE_ROW_HEIGHT);
      }
    });
    // The sticky rows are opaque, so the first scrolling row to draw is the first one below them.
    for (let i = findFirstRowBelow(rows, stickyBottom); i < offsets.length; i += 1) {
      const top = offsets[i];
      if (top >= scrollTop + viewportHeight) {
        break;
      }
      rowLines(grid, i, Math.max(top, stickyBottom), top + TREE_ROW_HEIGHT);
    }
    gridPathRef.current?.setAttribute('d', grid.join(''));

    // The accent marks the row the user points at, and the row that holds keyboard focus. A row in
    // the sticky stack is drawn at its slot, because its own row is behind the stack.
    const accent: string[] = [];
    const accentRow = (id: string) => {
      const slot = stickyIds.indexOf(id);
      const rowIndex = indexById.get(id);
      if (rowIndex === undefined) {
        return;
      }
      if (slot >= 0) {
        const top = scrollTop + slot * TREE_ROW_HEIGHT;
        rowLines(accent, rowIndex, top, top + TREE_ROW_HEIGHT);
        return;
      }
      const top = offsets[rowIndex];
      const bottom = top + TREE_ROW_HEIGHT;
      if (bottom > stickyBottom && top < scrollTop + viewportHeight) {
        rowLines(accent, rowIndex, Math.max(top, stickyBottom), bottom);
      }
    };
    const hovered = hoveredRowRef.current;
    if (hovered) {
      accentRow(hovered.id);
    }
    const focused = keyboardFocusedItemIdRef.current;
    if (focused && focused !== hovered?.id) {
      accentRow(focused);
    }
    accentPathRef.current?.setAttribute('d', accent.join(''));

    // The children of the selected story's parent keep one line at their own level, so the user
    // can see where the selection sits even when the rest of the grid is hidden. The line runs
    // from the first child down to the bottom of the last child's subtree.
    const selection: string[] = [];
    const parentId = selectedParentIdRef.current;
    const parentIndex = parentId === null ? undefined : indexById.get(parentId);
    const firstChildIndex = parentIndex === undefined ? undefined : parentIndex + 1;
    if (
      parentId !== null &&
      parentIndex !== undefined &&
      firstChildIndex !== undefined &&
      depths[firstChildIndex] === depths[parentIndex] + 1
    ) {
      const top = offsets[firstChildIndex];
      const bottom = subtreeBottoms.get(parentId) ?? 0;
      if (bottom > stickyBottom && top < scrollTop + viewportHeight) {
        line(
          selection,
          depths[firstChildIndex],
          Math.max(top, stickyBottom),
          Math.min(bottom, scrollTop + viewportHeight)
        );
      }
    }
    selectionPathRef.current?.setAttribute('d', selection.join(''));
  }, [scrollerRef, wrapperRef, rowsRef, stickyIdsRef, hoveredRowRef]);

  // Keyboard focus and selection move without a scroll event.
  useEffect(redraw, [redraw, keyboardFocusedItemId, selectedParentId]);

  const layer = (
    <IndentLineLayer aria-hidden="true" data-testid="indent-lines">
      <path ref={gridPathRef} data-indent-lines="grid" />
      <path ref={accentPathRef} data-indent-lines="accent" />
      <path ref={selectionPathRef} data-indent-lines="selection" />
    </IndentLineLayer>
  );

  return { layer, redraw };
}
