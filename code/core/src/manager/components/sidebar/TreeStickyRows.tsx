import React, { type RefObject } from 'react';

import { transparentize } from 'polished';
import type { API, IndexHash } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming/emotion';

import { EllipsisIcon } from '@storybook/icons';

import { getAncestorIds } from '../../utils/tree.ts';
import { getStatus } from '../../utils/status.tsx';
import { CollapseIcon } from './CollapseIcon.tsx';
import { hasContextMenu, hasProviderMenuEntriesFor } from './ContextMenu.tsx';
import { useRowStatus } from './StatusStore.tsx';
import {
  SECTION_GAP,
  TREE_CONTENT_INSET,
  TREE_INDENT_STEP,
  TREE_ROW_HEIGHT,
  findFirstRowBelow,
  treeTopWithin,
  type FlatRows,
} from './treeGeometry.ts';
import { IndentLines, type SelectionLine } from './TreeIndentLines.tsx';
import { iconSwap, truncatedLabel } from './treeRowStyles.ts';
import { TypeIconWithSymbol } from './TypeIcon.tsx';
import type { SidebarLabelContext } from './types.ts';

// Sticks to the top of the sidebar's scroll area while this tree is on screen, and scrolls away
// with the tree. It must be the tree's first child, so that it sticks from the tree's own top, and
// it takes no height of its own, so that it never pushes the rows down.
const StickyAnchor = styled.div({
  position: 'sticky',
  top: 0,
  height: 0,
  zIndex: 3,
});

const StickyStack = styled.div({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
});

const StickyRow = styled.button<{ $level: number; $isRoot: boolean }>(
  ({ $level, $isRoot, theme }) => ({
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
    fontSize: theme.typography.size.s2,
    color: $isRoot ? theme.textMutedColor : theme.color.defaultText,
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
    '&:hover': {
      color: theme.barHoverColor,
      svg: { color: 'currentColor' },
    },
    '&:hover::before': {
      background: theme.background.hoverable,
    },
    '& svg': {
      flexShrink: 0,
    },

    // The same accent as the grid layer's, for this row's own segments.
    '&:hover [data-indent-line], &[data-accent="true"] [data-indent-line]': {
      backgroundColor: transparentize(0.52, theme.color.secondary),
    },

    // The same icon swap as the scrolling rows: type icon at rest, collapse chevron on hover.
    ...iconSwap(['&:hover']),

    // Show the context menu button on hover; hide status icons when the menu button appears,
    // matching the scrolling rows' toggle pattern.
    '&:hover [data-sticky-menu]': { display: 'flex' },
    '&:hover [data-sticky-menu] ~ [data-sticky-status]': { display: 'none' },
  })
);

const StickyMenuButton = styled.div(({ theme }) => ({
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 20,
  height: 20,
  borderRadius: 4,
  padding: 0,
  color: 'inherit',
  background: 'transparent',
  cursor: 'pointer',
  position: 'relative',
  '&:hover': { background: theme.background.hoverable },
  svg: { width: 14, height: 14 },
}));

const StickyStatusContainer = styled.span({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  height: 24,
  gap: 4,
  padding: 5,
  flexShrink: 0,
  zIndex: 1,
});

// position: relative lifts the content above the row's ::before hover highlight, which a
// positioned pseudo-element would otherwise paint over.
const StickyRowIcon = styled.span({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

// The label must own the free space and truncate at a stable width, or the row content jumps
// sideways as sticky rows replace each other during a scroll.
const StickyLabel = styled.span(({ theme }) => ({
  ...truncatedLabel,
  position: 'relative',
  fontSize: theme.typography.size.s2,
}));

/**
 * Computes the IDs of TreeNodes that need to be made into sticky rows, given a scroll offset.
 *
 * Finds the first TreeNode below the current scroll offset, then finds all of its ancestors.
 *
 * The function performs further filtering to handle edge cases during transitions in the
 * sticky tree. There's a gap between the moment a new TreeNode branch scrolls to the bottom
 * of the sticky tree and to the top of scroll area. We need to move the sticky rows' content
 * out of the way as that new branch scrolls up so it doesn't disappear, but not all at the
 * same time so the tree's vertical position doesn't jump around.
 *
 * It's okay to find this function hard to understand. It is.
 */

export function getStickyRowIds(rows: FlatRows, data: IndexHash, scrollTop: number): string[] {
  const { ids, offsets, depths, indexById, subtreeBottoms } = rows;
  const topIndex = findFirstRowBelow(rows, scrollTop);
  if (topIndex >= ids.length) {
    return [];
  }
  const slotTop = (depth: number) => scrollTop + depth * TREE_ROW_HEIGHT;

  // Candidates: the ancestors of the first row under the viewport top, plus the rows below it
  // that have already met their slot. The walk stops at the first row that has not, because no
  // later row can have: offsets grow at least as fast as slot positions from one row to the next.
  const candidates = [...getAncestorIds(data, ids[topIndex])]
    .map((id) => indexById.get(id))
    .filter((index): index is number => index !== undefined);
  for (
    let index = topIndex;
    index < ids.length && offsets[index] < slotTop(depths[index]);
    index++
  ) {
    candidates.push(index);
  }

  const byDepth: string[] = [];
  for (const index of candidates) {
    const top = slotTop(depths[index]);
    const holdsSlot =
      offsets[index] < top && (subtreeBottoms.get(ids[index]) ?? 0) > top + TREE_ROW_HEIGHT;
    if (holdsSlot) {
      byDepth[depths[index]] = ids[index];
    }
  }

  const sticky: string[] = [];
  for (let depth = 0; depth < byDepth.length && byDepth[depth] !== undefined; depth++) {
    sticky.push(byDepth[depth]);
  }
  return sticky;
}

interface StickyRowItemProps {
  id: string;
  slot: number;
  data: IndexHash;
  api: API;
  labelContext: SidebarLabelContext;
  rowsRef: RefObject<FlatRows>;
  accentId: string | null;
  selectionLine: SelectionLine | null;
  onCollapse: (id: string) => void;
  openContextMenu?: (itemId: string) => void;
  hasTestProviders: boolean;
  scrollIntoSlot: (id: string, slot: number) => void;
  focusRealRow: (id: string, attempt?: number) => void;
}

function StickyRowItem({
  id,
  slot,
  data,
  api,
  labelContext,
  rowsRef,
  accentId,
  selectionLine,
  onCollapse,
  openContextMenu,
  hasTestProviders,
  scrollIntoSlot,
  focusRealRow,
}: StickyRowItemProps) {
  const theme = useTheme();
  const rowStatus = useRowStatus(id);

  const entry = data[id];
  const rowIndex = rowsRef.current?.indexById.get(id);
  if (!entry || rowIndex === undefined) {
    return null;
  }
  const level = rowsRef.current!.depths[rowIndex];

  const { icon: changeStatusIcon } = getStatus(theme, rowStatus.change);
  const { icon: testStatusIcon } = getStatus(theme, rowStatus.test);
  const hasStatus = Boolean(changeStatusIcon || testStatusIcon);

  return (
    <StickyRow
      $level={level}
      $isRoot={entry.type === 'root'}
      data-sticky-item-id={id}
      data-accent={id === accentId || undefined}
      type="button"
      tabIndex={-1}
      onClick={() => {
        scrollIntoSlot(id, slot);
        focusRealRow(id);
      }}
    >
      <IndentLines
        level={level}
        selectionLevel={selectionLine?.rowIds.has(id) ? selectionLine.level : 0}
      />
      <StickyRowIcon
        data-testid="sticky-collapse"
        onClick={(event) => {
          event.stopPropagation();
          onCollapse(id);
          scrollIntoSlot(id, slot);
          focusRealRow(id);
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
      {openContextMenu &&
        hasContextMenu(entry, hasProviderMenuEntriesFor(api, entry, hasTestProviders)) && (
          <StickyMenuButton
            data-sticky-menu
            data-testid="sticky-context-menu"
            aria-label="Open context menu"
            onClick={(e) => {
              e.stopPropagation();
              scrollIntoSlot(id, slot);
              // Wait one frame for the virtualizer to render the real row at its new
              // position before opening the menu on it.
              requestAnimationFrame(() => openContextMenu(id));
            }}
          >
            <EllipsisIcon />
          </StickyMenuButton>
        )}
      {hasStatus && (
        <StickyStatusContainer data-sticky-status>
          {changeStatusIcon}
          {testStatusIcon}
        </StickyStatusContainer>
      )}
    </StickyRow>
  );
}

interface StickyRowsProps {
  /** Ids of the sticky rows, from the top slot down. */
  ids: string[];
  /** The index the rows come from. */
  data: IndexHash;
  api: API;
  /** Passed to `renderLabel`, so that a sticky row reads the same as the row it covers. */
  labelContext: SidebarLabelContext;
  /** The sidebar's one scroll area. */
  scrollerRef: RefObject<HTMLElement | null> | null;
  /** The tree's own box, used to place its rows inside the scroll content. */
  wrapperRef: RefObject<HTMLElement | null>;
  /** Geometry of the visible rows. */
  rowsRef: RefObject<FlatRows>;
  /** The row that holds keyboard focus; its sticky copy colors its own indent lines. */
  accentId: string | null;
  /** The rows around the selected story; a sticky copy of one keeps their shared line visible. */
  selectionLine: SelectionLine | null;
  /** Collapse a branch after the user presses its chevron. */
  onCollapse: (id: string) => void;
  /** Open the context menu on the real (non-sticky) row with this id. */
  openContextMenu?: (itemId: string) => void;
  /** Whether any test provider addon is registered, for gating the ⋯ button. */
  hasTestProviders: boolean;
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
  wrapperRef,
  rowsRef,
  accentId,
  selectionLine,
  onCollapse,
  openContextMenu,
  hasTestProviders,
}: StickyRowsProps) {
  if (ids.length === 0) {
    return null;
  }

  // Scroll the real row to the exact position its sticky copy holds, so that nothing appears to
  // move under the pointer.
  const scrollIntoSlot = (id: string, slot: number) => {
    const scroller = scrollerRef?.current;
    const wrapper = wrapperRef.current;
    const rows = rowsRef.current;
    const index = rows?.indexById.get(id);
    if (!scroller || !wrapper || !rows || index === undefined) {
      return;
    }
    scroller.scrollTop =
      treeTopWithin(scroller, wrapper) + rows.offsets[index] - slot * TREE_ROW_HEIGHT;
  };

  // Hand focus to the real row after an activation. The sticky copy is aria-hidden and unmounts
  // as the stack changes, so focus left on it would fall back to the body and break arrow-key
  // navigation. The virtualizer can mount the real row a frame after the scroll, hence retries.
  const focusRealRow = (id: string, attempt = 0) => {
    const row = wrapperRef.current?.querySelector<HTMLElement>(
      `[data-item-id="${CSS.escape(id)}"]`
    );
    if (row) {
      row.focus({ preventScroll: true });
    } else if (attempt < 10) {
      requestAnimationFrame(() => focusRealRow(id, attempt + 1));
    }
  };

  return (
    <StickyAnchor aria-hidden="true">
      <StickyStack data-testid="sticky-overlay">
        {ids.map((id, slot) => (
          <StickyRowItem
            key={id}
            id={id}
            slot={slot}
            data={data}
            api={api}
            labelContext={labelContext}
            rowsRef={rowsRef}
            accentId={accentId}
            selectionLine={selectionLine}
            onCollapse={onCollapse}
            openContextMenu={openContextMenu}
            hasTestProviders={hasTestProviders}
            scrollIntoSlot={scrollIntoSlot}
            focusRealRow={focusRealRow}
          />
        ))}
      </StickyStack>
    </StickyAnchor>
  );
}
