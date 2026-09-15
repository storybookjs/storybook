import React, { useEffect, useRef } from 'react';

import { styled } from 'storybook/theming';

import { TREE_CONTENT_INSET, TREE_INDENT_STEP, type FlatRows } from './treeGeometry.ts';

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
}));

/**
 * The indent lines of one row, levels 1 to `level`. Each row and each sticky copy carries its
 * own, so the lines scroll and stick on the compositor with the row that owns them. The host row
 * colors them on hover and keyboard focus through `[data-indent-line]`.
 */
export function IndentLines({ level }: { level: number }) {
  return (
    <>
      {Array.from({ length: level }, (_, index) => (
        <IndentLine
          key={index}
          data-indent-line
          aria-hidden="true"
          style={{ left: indentLineX(index + 1) }}
        />
      ))}
    </>
  );
}

const SelectionLineLayer = styled.svg(({ theme }) => ({
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
}));

interface SelectionLineOptions {
  /** Geometry of the visible rows. */
  rows: FlatRows;
  /** Parent of the selected story. Its children share the selection line. */
  selectedParentId: string | null;
}

/**
 * Draw the selection line and return the layer to render.
 *
 * The children of the selected story's parent keep one line at their own level, so the user can
 * see where the selection sits even while the indent lines are hidden. The line spans many rows,
 * so it cannot be carried by one of them; it is drawn once per geometry change in the tree's own
 * coordinates, and scrolls with the content.
 */
export function useSelectionLine({ rows, selectedParentId }: SelectionLineOptions) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const { offsets, depths, indexById, subtreeBottoms } = rows;
    let d = '';
    const parentIndex = selectedParentId === null ? undefined : indexById.get(selectedParentId);
    const firstChildIndex = parentIndex === undefined ? undefined : parentIndex + 1;
    if (
      selectedParentId !== null &&
      parentIndex !== undefined &&
      firstChildIndex !== undefined &&
      depths[firstChildIndex] === depths[parentIndex] + 1
    ) {
      // The half pixel keeps the 1px stroke on the device pixel grid.
      const x = indentLineX(depths[firstChildIndex]) + 0.5;
      d = `M${x} ${offsets[firstChildIndex]}V${subtreeBottoms.get(selectedParentId) ?? 0}`;
    }
    pathRef.current?.setAttribute('d', d);
  }, [rows, selectedParentId]);

  const layer = (
    <SelectionLineLayer aria-hidden="true" data-testid="indent-lines">
      <path ref={pathRef} data-indent-lines="selection" />
    </SelectionLineLayer>
  );

  return { layer };
}
