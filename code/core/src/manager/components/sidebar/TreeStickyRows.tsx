import React, { type RefObject } from 'react';

import type { API, IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getAncestorIds } from '../../utils/tree.ts';
import { CollapseIcon } from './CollapseIcon.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';
import type { SidebarLabelContext } from './types.ts';
import { iconSwap, truncatedLabel } from './treeRowStyles.ts';
import {
  SECTION_GAP,
  TREE_CONTENT_INSET,
  TREE_INDENT_STEP,
  TREE_ROW_HEIGHT,
  findFirstRowBelow,
  type FlatRows,
} from './treeGeometry.ts';

const StickyOverlay = styled.div({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  // Under the indent lines, so that the gradient below does not cut a line in two.
  zIndex: 3,
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: SECTION_GAP,
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, var(--sticky-row-background), transparent)',
  },
});

const StickyRow = styled.button<{ $level: number }>(({ $level, theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: TREE_ROW_HEIGHT,
  overflow: 'hidden',
  border: 0,
  margin: 0,
  paddingBlock: 0,
  paddingInlineEnd: 8,
  paddingInlineStart: `calc(${$level} * ${TREE_INDENT_STEP}px + ${TREE_CONTENT_INSET}px)`,
  gap: 6,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: theme.color.defaultText,
  // An opaque square backing, so that the sticky row hides the scrolling rows behind it.
  backgroundColor: 'var(--sticky-row-background)',
  // The hover highlight needs its own rounded inset layer, as on the scrolling rows. The square
  // backing cannot carry it, because the rows behind would show through its rounded corners.
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    pointerEvents: 'none',
  },
  '&:hover::before': {
    background: theme.background.hoverable,
  },
  '& svg': {
    flexShrink: 0,
  },

  // The same icon swap as the scrolling rows: type icon at rest, collapse chevron on hover.
  ...iconSwap(['&:hover']),
}));

// position: relative lifts the content above the row's ::before hover highlight, which a
// positioned pseudo-element would otherwise paint over.
const StickyRowIcon = styled.span({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

// The label must own the free space and truncate at a stable width, or the row content jumps
// sideways as sticky rows replace each other during a scroll.
const StickyLabel = styled.span({
  ...truncatedLabel,
  position: 'relative',
});

/**
 * The rows to keep at the top of the tree for a given scroll offset, from the top slot down.
 *
 * The list holds the ancestors of the row on the top line, and that row itself while its own
 * subtree continues below it. A row keeps its slot only while its own row is above that slot, and
 * while its subtree still reaches below the bottom edge of the slot. The second rule drops the
 * deepest sticky rows when the header of the next section reaches the stack, so that the incoming
 * header is never covered. Both rules fail from the deepest row upward, so the rows that stay keep
 * their slot index.
 */
export function getStickyRowIds(rows: FlatRows, data: IndexHash, scrollTop: number): string[] {
  const { ids, offsets, indexById, subtreeBottoms } = rows;
  const topIndex = findFirstRowBelow(rows, scrollTop);
  if (topIndex >= ids.length) {
    return [];
  }
  const topId = ids[topIndex];
  const ancestorIds = [...getAncestorIds(data, topId)].reverse();
  const nextId = ids[topIndex + 1];
  if (nextId && getAncestorIds(data, nextId).includes(topId)) {
    ancestorIds.push(topId);
  }
  return ancestorIds.filter((id, slot) => {
    const index = indexById.get(id);
    return (
      index !== undefined &&
      offsets[index] < scrollTop + slot * TREE_ROW_HEIGHT &&
      (subtreeBottoms.get(id) ?? 0) > scrollTop + (slot + 1) * TREE_ROW_HEIGHT
    );
  });
}

interface StickyRowsProps {
  /** Ids of the sticky rows, from the top slot down. */
  ids: string[];
  /** The index the rows come from. */
  data: IndexHash;
  api: API;
  /** Passed to `renderLabel`, so that a sticky row reads the same as the row it covers. */
  labelContext: SidebarLabelContext;
  /** The element that scrolls the rows. */
  scrollerRef: RefObject<HTMLElement | null>;
  /** Geometry of the visible rows. */
  rowsRef: RefObject<FlatRows>;
  /** Collapse a branch after the user presses its chevron. */
  onCollapse: (id: string) => void;
}

/**
 * The ancestors of the top row, kept in view above the tree.
 *
 * The rows render as an overlay rather than with `position: sticky`, which cannot apply to the
 * absolutely positioned rows of a virtualized list. They are a pointer affordance only: the real
 * rows carry the tree semantics, so the overlay stays out of the tab order and out of the
 * accessibility tree.
 */
export function TreeStickyRows({
  ids,
  data,
  api,
  labelContext,
  scrollerRef,
  rowsRef,
  onCollapse,
}: StickyRowsProps) {
  if (ids.length === 0) {
    return null;
  }

  // Scroll the real row to the exact position its sticky copy holds, so that nothing appears to
  // move under the pointer.
  const scrollIntoSlot = (id: string, slot: number) => {
    const scroller = scrollerRef.current;
    const rows = rowsRef.current;
    const index = rows?.indexById.get(id);
    if (!scroller || !rows || index === undefined) {
      return;
    }
    scroller.scrollTop = rows.offsets[index] - slot * TREE_ROW_HEIGHT;
  };

  return (
    <StickyOverlay data-testid="sticky-overlay" aria-hidden="true">
      {ids.map((id, slot) => {
        const entry = data[id];
        const rowIndex = rowsRef.current?.indexById.get(id);
        if (!entry || rowIndex === undefined) {
          return null;
        }
        return (
          <StickyRow
            key={id}
            $level={rowsRef.current!.depths[rowIndex]}
            data-sticky-item-id={id}
            type="button"
            tabIndex={-1}
            onClick={() => scrollIntoSlot(id, slot)}
          >
            <StickyRowIcon
              data-testid="sticky-collapse"
              onClick={(event) => {
                event.stopPropagation();
                onCollapse(id);
                scrollIntoSlot(id, slot);
              }}
            >
              {entry.type === 'root' ? (
                <CollapseIcon isExpanded />
              ) : (
                <>
                  <span className="hover-only">
                    <CollapseIcon isExpanded />
                  </span>
                  <span className="static-only">
                    <TypeIconWithSymbol item={entry} />
                  </span>
                </>
              )}
            </StickyRowIcon>
            <StickyLabel>{entry.renderLabel?.(entry, api, labelContext) || entry.name}</StickyLabel>
          </StickyRow>
        );
      })}
    </StickyOverlay>
  );
}
