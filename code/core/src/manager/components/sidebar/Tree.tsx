import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PRELOAD_ENTRIES, SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';
import { TooltipNote } from 'storybook/internal/components';

import { Collection } from 'react-aria-components/Collection';
import { Tree as AriaTree } from 'react-aria-components/Tree';
import { ListLayout, Virtualizer } from 'react-aria-components/Virtualizer';

import {
  type TreeEntry,
  collapseSingleStoryComponents,
  getAncestorIds,
  indexToTree,
} from '../../utils/tree.ts';
import { SECTION_GAP, TREE_ROW_HEIGHT, Traces, TreeNode, type TreeNodeProps } from './TreeNode.tsx';

import {
  Addon_TypesEnum,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { shortcutToHumanString, useStorybookApi, type IndexHash } from 'storybook/manager-api';
import { transparentize } from 'polished';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';
import { getGroupDualStatus } from '../../utils/status.tsx';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { useExpanded } from './useExpanded.ts';
import { StatusContext } from './StatusContext.tsx';
import { RowUiContext, createRowUiStore } from './RowUiContext.tsx';
import { CollapseIcon } from './CollapseIcon.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';
import type { ContextMenuEntryMethod } from './ContextMenu.tsx';
import { generateTestProviderLinks, hasContextMenu } from './ContextMenu.tsx';

// FIXME/TODO: Review with MA: should clicking on a story with children also navigate to it?
// -> Add a "Story" item in the tree, or get a commitment from the team to remove .test
// FIXME/TODO: Tree is no longer showing the section animation on F6 after an item is focused
// FIXME/TODO: add a level for trees with a RefHead.

const StyledAriaTree = styled(AriaTree)(({ theme }) => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  outline: 'none',
  // The virtualizer makes the tree its own scroll container; the parent must bound its height.
  height: '100%',
  overflow: 'auto',
  // Reserve room under the floating sidebar-bottom widget (its measured height, published as a
  // CSS variable) so the last rows can scroll clear of it. 0 when no widget is mounted.
  paddingBottom: 'var(--sidebar-bottom-height, 0px)',

  // Match the ScrollArea look: a thin muted thumb on a transparent track, only visible while
  // hovering or keyboard-focused inside the tree.
  scrollbarWidth: 'thin',
  scrollbarColor: 'transparent transparent',
  '&::-webkit-scrollbar': {
    width: 6,
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  '&:hover, &:focus-within': {
    scrollbarColor: `${transparentize(0.5, theme.textMutedColor)} transparent`,
  },
  '&:hover::-webkit-scrollbar-thumb, &:focus-within::-webkit-scrollbar-thumb': {
    backgroundColor: transparentize(0.5, theme.textMutedColor),
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: transparentize(0.2, theme.textMutedColor),
  },
}));

const TreeWrapper = styled.div(({ theme }) => ({
  position: 'relative',
  height: '100%',
  minHeight: 0,
  // Contain the overlay's z-index so UI outside the tree still paints above it.
  isolation: 'isolate',
  '--sticky-bg': theme.background.content,
  // Show trace lines only while hovering or keyboard-focused inside the tree. Scoped to the whole
  // wrapper (not just the scroller) so the pinned overlay's lines follow the same rule instead of
  // being permanently drawn.
  '&:hover, &:has(:focus-visible)': {
    '--trace-opacity': 1,
  },
  [MEDIA_DESKTOP_BREAKPOINT]: {
    '--sticky-bg': theme.background.app,
  },
  // Soft fade at the bottom of the scroll area, easing the cut-off into the rest of the UI.
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    pointerEvents: 'none',
    background: 'linear-gradient(to top, var(--sticky-bg), transparent)',
  },
}));

const PinnedOverlay = styled.div(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 3,
  '--trace-color': theme.appBorderColor,
  // Soft fade between the pinned stack and the scrolling rows beneath it.
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: SECTION_GAP,
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, var(--sticky-bg), transparent)',
  },
  // The bridge continues the deepest pinned row's lines, so it blues with that row (the last
  // pinned button) — keeping the continued line one colour on hover.
  '&:has([data-pinned-item-id]:last-of-type:hover) [data-pinned-bridge]': {
    '--trace-color': transparentize(0.52, theme.color.secondary),
  },
}));

const PinnedRow = styled.button<{ $level: number }>(({ $level, theme }) => ({
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
  paddingInlineStart: `calc(${$level} * 20px + 7px)`,
  gap: 6,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: theme.color.defaultText,
  // Opaque, square backing so the pinned row fully occludes the scrolling rows beneath it.
  backgroundColor: 'var(--sticky-bg)',
  // Hover highlight on a rounded inset layer, matching the natural rows' ::before (which the
  // square backing cannot carry without letting the rows below show through its rounded corners).
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
  // Blue the trace lines on hover, like natural rows (StyledTreeItem).
  '&:hover': {
    '--trace-color': transparentize(0.52, theme.color.secondary),
  },
  '& svg': {
    flexShrink: 0,
  },

  // Same icon swap as natural rows: type icon at rest, collapse chevron while hovered.
  '.hover-only': {
    display: 'none',
  },
  '&:hover .hover-only': {
    display: 'flex',
    alignItems: 'center',
  },
  '.static-only': {
    display: 'flex',
    alignItems: 'center',
  },
  '&:hover .static-only': {
    display: 'none',
  },
}));

// position: relative lifts the content above the row's ::before hover highlight (a positioned
// pseudo-element would otherwise paint over it), matching the natural rows' relative StyledContent.
const PinnedRowIcon = styled.span({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

// Zero-width anchor fixed at the natural row's content-box start (level indent, before the
// 7px content padding), so the trace lines it hosts land exactly where real rows draw them.
// Out of the flex flow, or the row gap would push the icon off the natural rows' grid.
const PinnedTraceAnchor = styled.span<{ $level: number }>(({ $level }) => ({
  position: 'absolute',
  insetBlock: 0,
  insetInlineStart: `calc(${$level} * 20px)`,
  width: 0,
}));

// Continues the deepest pinned row's ancestor trace lines down through the fade, so they read as
// one line with the scrolling rows below instead of being cut by the fade. Painted above the fade
// (which sits at the overlay's ::after, z-index auto). Anchored like PinnedTraceAnchor.
const PinnedFadeBridge = styled.span<{ $level: number }>(({ $level }) => ({
  position: 'absolute',
  top: '100%',
  height: SECTION_GAP,
  insetInlineStart: `calc(${$level} * 20px)`,
  width: 0,
  zIndex: 1,
  pointerEvents: 'none',
}));

// The label must own the free space and truncate stably, or the row content jitters
// horizontally as pinned rows swap while scrolling. position: relative keeps it above the row's
// ::before hover highlight (see PinnedRowIcon).
const PinnedLabel = styled.span({
  position: 'relative',
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// Without CSS anchor positioning the note cannot follow the focused row, and without
// `position-visibility` (not yet in Chrome) nothing hides it while no row holds the anchor
// (mouse focus is not :focus-visible) — either way it would sit as a stray pill over the
// sidebar, so it only renders where both work.
const supportsAnchorPositioning =
  typeof CSS !== 'undefined' &&
  !!CSS.supports?.('anchor-name: --sb-probe') &&
  !!CSS.supports?.('position-visibility: anchors-valid');

const FocusTooltipNote = styled(TooltipNote)({
  marginBlockStart: 8,
  marginInlineEnd: -4,
  position: 'fixed',
  zIndex: 2,
  positionAnchor: '--focused-treenode',
  positionArea: 'span-x-start y-end',
  positionVisibility: 'anchors-valid',
});

interface TreeProps {
  allStatuses?: StatusesByStoryIdAndTypeId;
  /** Active inclusive status filters; passed as a prop so Tree doesn't subscribe to all state. */
  includedStatusFilters?: StatusValue[];
  refId: string;
  data: IndexHash;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}

export const Tree = React.memo<TreeProps>(function Tree({
  allStatuses: allStatusesProp,
  includedStatusFilters,
  refId,
  data: dataProp,
  selectedStoryId,
  onSelectStoryId: onSelectStoryIdProp,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();
  const { isMobile } = useLayout();
  // Mirrors the labelContext TreeNode passes to renderLabel, so pinned copies match their rows.
  const labelContext = useMemo(() => ({ isMobile, location: 'sidebar' as const }), [isMobile]);
  const isModifiedFilterActive = (includedStatusFilters ?? []).includes('status-value:modified');
  // Whether any test provider is registered: gates the context menu on group/component rows.
  const hasTestProviders =
    Object.keys(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER)).length > 0;

  // The manager recreates the index and status records on unrelated state ticks. Their
  // identities feed the react-aria collection (items + dependencies) and the status context,
  // where a fresh identity re-renders every row in the tree — seconds when fully expanded.
  // Reuse the previous identity while the entries themselves are unchanged.
  const data = useStableIdentity(dataProp);
  const allStatuses = useStableIdentity(allStatusesProp);

  // Keep the selection callback identity stable for the same reason: it feeds the memoized
  // row renderer.
  const onSelectStoryIdRef = useRef(onSelectStoryIdProp);
  onSelectStoryIdRef.current = onSelectStoryIdProp;
  const onSelectStoryId = useCallback((id: string) => onSelectStoryIdRef.current(id), []);

  // Tracks the currently focused item for the ContextMenu global shortcut.
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Tracks the last focused item to detect when we switch to no item being focused.
  const focusedItemIdRef = useRef<string | null>(null);

  // Context-menu state: which item's menu is open, and how it was triggered.
  // 'pointer' = mouse click on the ⋯ button; 'keyboard' = global shortcut or Enter/Space on the
  // ⋯ button (shows extra actions and autofocuses the first item).
  const [contextMenuState, setContextMenuState] = useState<{
    itemId: string;
    entryMethod: ContextMenuEntryMethod;
  } | null>(null);

  // Rewrite the dataset to place the single child story in place of the component.
  const collapsedData = useMemo(() => collapseSingleStoryComponents(data), [data]);

  // Switch to a tree structure from now on.
  const tree = useMemo(() => indexToTree(collapsedData), [collapsedData]);

  // Track expanded nodes, keep it in sync with props and enable keyboard shortcuts.
  const [expanded, setExpanded] = useExpanded({
    refId,
    data: collapsedData,
    selectedStoryId,
  });

  const groupDualStatus = useMemo(
    () => getGroupDualStatus(collapsedData, allStatuses ?? {}),
    [collapsedData, allStatuses]
  );

  const contextMenuShortcut = useMemo(() => {
    const shortcutKeys = api.getShortcutKeys();
    if (!shortcutKeys?.contextMenu) {
      return undefined;
    }

    return shortcutToHumanString(shortcutKeys.contextMenu);
  }, [api]);

  // Compute tooltip data only for the focused item (duplicates TreeNode logic by design).
  const focusedItemShortcutLabel = useMemo(() => {
    if (!focusedItemId || !contextMenuShortcut) {
      return null;
    }

    const item = collapsedData[focusedItemId];
    if (!item) {
      return null;
    }

    const providerMenuAvailable =
      hasTestProviders &&
      generateTestProviderLinks(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER), item)
        .length > 0;
    if (!hasContextMenu(item, providerMenuAvailable)) {
      return null;
    }

    const itemStatus = groupDualStatus?.[focusedItemId];
    const changeStatus = itemStatus?.change.value ?? 'status-value:unknown';
    const testStatus = itemStatus?.test.value ?? 'status-value:unknown';

    return changeStatus !== 'status-value:unknown' || testStatus !== 'status-value:unknown'
      ? 'Status and actions'
      : 'Actions';
  }, [focusedItemId, contextMenuShortcut, collapsedData, groupDualStatus, hasTestProviders, api]);

  // React-aria expects a Set for selectedKeys. Memoize so Tree's children see a stable ref.
  const selectedKeys = useMemo(
    () => (selectedStoryId ? new Set([selectedStoryId]) : EMPTY_KEYS),
    [selectedStoryId]
  );

  const selectedParentId = useMemo(() => {
    if (!selectedStoryId) {
      return null;
    }
    const entry = collapsedData[selectedStoryId];
    if (!entry) {
      return null;
    }
    if (entry.type === 'root') {
      return null;
    }
    return entry.parent ?? null;
  }, [selectedStoryId, collapsedData]);

  // Stable handlers so children (especially TreeNode) can rely on prop identity.
  const handleExpandedChange = useCallback(
    (keys: Set<React.Key>) => {
      setExpanded({ ids: Array.from(keys).map(String) });
    },
    [setExpanded]
  );

  // react-aria's selectionBehavior="replace" makes selection follow focus, so onSelectionChange
  // fires as focus moves (arrow keys, Tab, programmatic focus) — not only on genuine activation.
  // Acting on those would expand/collapse a branch or navigate a story merely because focus
  // landed on the row. This flag is true only while a pointer press or Space keypress is being
  // handled on the tree, so handleSelectionChange can ignore focus-driven changes. Enter and
  // double-click activate through onAction, which fires regardless.
  const isActivatingRef = useRef(false);
  // The modality of the last input inside the tree. The ⋯ button opens its menu through
  // react-aria's press handling, which doesn't tell us whether it was a click or Enter/Space, so
  // the capture-phase listeners below record it: opening the menu via keyboard autofocuses the
  // first item, while a mouse click does not.
  const lastInputModalityRef = useRef<ContextMenuEntryMethod>('pointer');
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const arm = (event: PointerEvent | KeyboardEvent) => {
      lastInputModalityRef.current = event.type === 'pointerdown' ? 'pointer' : 'keyboard';
      if (event.type === 'pointerdown' || (event as KeyboardEvent).key === ' ') {
        isActivatingRef.current = true;
      }
    };
    const disarm = () => {
      isActivatingRef.current = false;
    };
    container.addEventListener('pointerdown', arm, { capture: true });
    container.addEventListener('keydown', arm, { capture: true });
    // pointerup can land outside the row (or the tree) after a drag, so listen on the window.
    window.addEventListener('pointerup', disarm, { capture: true });
    container.addEventListener('keyup', disarm, { capture: true });
    return () => {
      container.removeEventListener('pointerdown', arm, { capture: true });
      container.removeEventListener('keydown', arm, { capture: true });
      window.removeEventListener('pointerup', disarm, { capture: true });
      container.removeEventListener('keyup', disarm, { capture: true });
    };
  }, []);

  // Use refs so the callbacks below can read the latest values without re-creating.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const collapsedDataRef = useRef(collapsedData);
  collapsedDataRef.current = collapsedData;
  const selectedStoryIdRef = useRef(selectedStoryId);
  selectedStoryIdRef.current = selectedStoryId;

  const updateFocusedItemId = useCallback((itemId: string | null) => {
    focusedItemIdRef.current = itemId;
    setFocusedItemId((current) => (current === itemId ? current : itemId));
  }, []);

  // Helper: returns true when an item ID corresponds to a branch (has children).
  const isBranch = useCallback((id: string): boolean => {
    const item = collapsedDataRef.current[id];
    return !!(
      item &&
      'children' in item &&
      Array.isArray((item as { children?: string[] }).children) &&
      (item as { children: string[] }).children.length > 0
    );
  }, []);

  // Click (single) and Space both fire onSelectionChange.
  //   • Branch items: toggle expand/collapse (do NOT navigate).
  //   • Leaf items: navigate to story/docs via onSelectStoryId.
  const handleSelectionChange = useCallback(
    (keys: 'all' | Set<React.Key>) => {
      if (keys === 'all') {
        return;
      }
      // Ignore selection changes that merely follow focus (arrow keys, Tab, programmatic focus):
      // only a pointer press or Space activates a row. Otherwise navigating past a branch would
      // toggle its expansion. See isActivatingRef.
      if (!isActivatingRef.current) {
        return;
      }
      const selectedKey = Array.from(keys)[0];
      if (!selectedKey || typeof selectedKey !== 'string') {
        return;
      }

      if (isBranch(selectedKey)) {
        setExpanded({
          ids: [selectedKey],
          append: true,
          value: !expandedRef.current.has(selectedKey),
        });
      } else {
        onSelectStoryId(selectedKey);
      }
    },
    [onSelectStoryId, isBranch, setExpanded]
  );

  // Enter / double-click fire onAction — same logic as single click.
  const handleAction = useCallback(
    (key: React.Key) => {
      const keyStr = String(key);
      if (isBranch(keyStr)) {
        setExpanded({ ids: [keyStr], append: true, value: !expandedRef.current.has(keyStr) });
      } else {
        onSelectStoryId(keyStr);
      }
    },
    [isBranch, setExpanded, onSelectStoryId]
  );

  // Open or close the context menu. Stable callback for children. When the caller does not specify
  // an entry method (the ⋯ button), derive it from the last input modality so Enter/Space open with
  // keyboard semantics (autofocus) and a mouse click opens with pointer semantics.
  const openContextMenu = useCallback((itemId: string, entryMethod?: ContextMenuEntryMethod) => {
    setContextMenuState({ itemId, entryMethod: entryMethod ?? lastInputModalityRef.current });
  }, []);
  const closeContextMenu = useCallback(() => setContextMenuState(null), []);

  // Preload a branch row's first child story on hover (restores the pre-rewrite behavior) so
  // the preview has usually started loading by the time the user clicks. One delegated listener
  // instead of a handler per row.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !api) {
      return;
    }

    let lastPreloadedId: string | null = null;
    const onMouseOver = (event: MouseEvent) => {
      const row = (event.target as Element | null)?.closest?.('[data-item-id]');
      if (!row || !container.contains(row)) {
        return;
      }
      const itemId = row.getAttribute('data-item-id');
      if (!itemId || itemId === lastPreloadedId) {
        return;
      }
      lastPreloadedId = itemId;
      const item = collapsedDataRef.current[itemId];
      if (
        item &&
        (item.type === 'component' || item.type === 'story') &&
        'children' in item &&
        item.children?.length
      ) {
        api.emit(PRELOAD_ENTRIES, { ids: [item.children[0]], options: { target: refId } });
      }
    };

    container.addEventListener('mouseover', onMouseOver, { passive: true });
    return () => container.removeEventListener('mouseover', onMouseOver);
  }, [api, refId]);

  // Track focused item via one MutationObserver, batched with rAF.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const focusedElement = container.querySelector<HTMLElement>(
      '[data-focused="true"][data-item-id]'
    );
    const focusedId = focusedElement?.getAttribute('data-item-id') ?? null;
    updateFocusedItemId(focusedId);

    let rafId: number | null = null;
    const pendingMutations: MutationRecord[] = [];

    const processMutations = () => {
      rafId = null;

      for (const mutation of pendingMutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-focused' &&
          mutation.target instanceof HTMLElement
        ) {
          const el = mutation.target;
          const itemId = el.getAttribute('data-item-id');

          if (el.getAttribute('data-focused') === 'true') {
            updateFocusedItemId(itemId);
          } else if (focusedItemIdRef.current === itemId) {
            updateFocusedItemId(null);
          }
        }
      }

      pendingMutations.length = 0;
    };

    const observer = new MutationObserver((mutations) => {
      pendingMutations.push(...mutations);
      if (rafId === null) {
        rafId = requestAnimationFrame(processMutations);
      }
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['data-focused'],
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [updateFocusedItemId]);

  // Flattened visible rows in render order, with arithmetic geometry. The tree is
  // virtualized, so most rows have no DOM node to measure: positions derive from the fixed
  // row height plus the deterministic section gap (mirrored in TreeNode's padding rule).
  const flatRows = useMemo(() => {
    const ids: string[] = [];
    const gapIds = new Set<string>();
    const offsets: number[] = [];
    const indexById = new Map<string, number>();
    const subtreeBottoms = new Map<string, number>();
    let y = 0;
    let prevLevel1 = true;
    const walk = (entries: TreeEntry[], level: number) => {
      for (const entry of entries) {
        const isLevel1 = level === 1;
        const hasGap = isLevel1 && ids.length > 0 && !prevLevel1;
        if (hasGap) {
          gapIds.add(entry.id);
        }
        indexById.set(entry.id, ids.length);
        ids.push(entry.id);
        offsets.push(y + (hasGap ? SECTION_GAP : 0));
        y += TREE_ROW_HEIGHT + (hasGap ? SECTION_GAP : 0);
        prevLevel1 = isLevel1;
        if (entry.resolvedChildren?.length && expanded.has(entry.id)) {
          walk(entry.resolvedChildren, level + 1);
        }
        subtreeBottoms.set(entry.id, y);
      }
    };
    walk(tree, 1);
    return { ids, gapIds, offsets, indexById, subtreeBottoms, totalHeight: y };
  }, [tree, expanded]);
  const flatRowsRef = useRef(flatRows);
  flatRowsRef.current = flatRows;

  // VSCode-style sticky scroll, rendered as an overlay above the virtualized scroller (CSS
  // position:sticky cannot work on virtualized, absolutely-positioned rows). The chain is the
  // strict ancestors of the row at the viewport's top line, plus that row itself while its own
  // subtree continues below it; each pinned row hands off once the rows below its slot leave
  // its subtree, so an incoming container's header is never covered by the stack.
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  useEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) {
      return;
    }
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const { ids, offsets, indexById, subtreeBottoms } = flatRowsRef.current;
      const targetY = scroller.scrollTop;
      // First row whose bottom is below the top line (bottom = next row's offset, or the
      // row's own offset + height for the last row).
      let lo = 0;
      let hi = ids.length - 1;
      let topIndex = ids.length;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const bottom = mid + 1 < ids.length ? offsets[mid + 1] : offsets[mid] + TREE_ROW_HEIGHT;
        if (bottom <= targetY) {
          lo = mid + 1;
        } else {
          topIndex = mid;
          hi = mid - 1;
        }
      }
      let chainIds: string[] = [];
      if (topIndex < ids.length) {
        const topId = ids[topIndex];
        chainIds = [...getAncestorIds(collapsedDataRef.current, topId)].reverse();
        const nextId = ids[topIndex + 1];
        if (nextId && getAncestorIds(collapsedDataRef.current, nextId).includes(topId)) {
          chainIds.push(topId);
        }
        // A chain row pins only while its natural row is above its slot (a chain root at the
        // top of the viewport is not overlaid by its own copy) and its subtree still extends
        // below the slot's bottom edge — otherwise the next container's header would slide
        // under the stack, so the bottom pinned rows hand off to it instead (VSCode push-out).
        // Both conditions fail monotonically with depth, so dropped rows form a suffix and
        // surviving rows keep their slot index.
        chainIds = chainIds.filter((id, i) => {
          const index = indexById.get(id);
          return (
            index !== undefined &&
            offsets[index] < targetY + i * TREE_ROW_HEIGHT &&
            (subtreeBottoms.get(id) ?? 0) > targetY + (i + 1) * TREE_ROW_HEIGHT
          );
        });
      }
      setPinnedIds((prev) =>
        prev.length === chainIds.length && prev.every((id, i) => id === chainIds[i])
          ? prev
          : chainIds
      );
    };
    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };
    update();
    scroller.addEventListener('scroll', scheduleUpdate, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', scheduleUpdate);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [flatRows]);

  // Clicking a pinned row scrolls its real row to the exact position the pinned copy occupies
  // (slot i of the overlay), so nothing appears to move.
  const scrollPinnedRowIntoPlace = useCallback((itemId: string, overlayIndex: number) => {
    const scroller = containerRef.current;
    const { offsets, indexById } = flatRowsRef.current;
    const index = indexById.get(itemId);
    if (!scroller || index === undefined) {
      return;
    }
    scroller.scrollTop = offsets[index] - overlayIndex * TREE_ROW_HEIGHT;
  }, []);

  // Scroll a row into view arithmetically: virtualized rows may not exist in the DOM, and the
  // pinned overlay covers the top of the viewport, so the target lands below the prospective
  // stack (the target's own ancestors).
  const scrollRowIntoView = useCallback((itemId: string, block: ScrollLogicalPosition): boolean => {
    const scroller = containerRef.current;
    if (!scroller) {
      return false;
    }
    const { offsets, indexById } = flatRowsRef.current;
    const index = indexById.get(itemId);
    if (index === undefined) {
      return false;
    }
    const offset = offsets[index];
    // The pinned overlay covers `stack` px at the top; the floating sidebar-bottom widget covers
    // `bottomInset` px at the bottom (its height, reserved as the scroller's padding-bottom). A
    // row is only truly visible between them.
    const stack = getAncestorIds(collapsedDataRef.current, itemId).length * TREE_ROW_HEIGHT;
    const bottomInset = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
    if (block === 'center') {
      const half = Math.max((scroller.clientHeight - bottomInset - TREE_ROW_HEIGHT) / 2, stack);
      scroller.scrollTop = offset - half;
      return true;
    }
    const viewTop = scroller.scrollTop + stack;
    const viewBottom = scroller.scrollTop + scroller.clientHeight - bottomInset - TREE_ROW_HEIGHT;
    if (offset < viewTop) {
      scroller.scrollTop = offset - stack;
    } else if (offset > viewBottom) {
      // Reveal the row just above the widget, rather than jumping it to the top.
      scroller.scrollTop = offset + TREE_ROW_HEIGHT + bottomInset - scroller.clientHeight;
    }
    return true;
  }, []);

  // Keep the keyboard-focused row clear of the pinned overlay and the floating bottom widget.
  // RAC scrolls a focused row only within the raw viewport, so a row behind either overlay counts
  // as "visible" and no scroll fires — the user has to keep pressing until focus clears the stack.
  // scrollRowIntoView knows both insets, and no-ops when the row is already fully visible. Gated to
  // keyboard navigation: a pointer click must not jump-scroll the row it lands on.
  useEffect(() => {
    if (focusedItemId && lastInputModalityRef.current === 'keyboard') {
      scrollRowIntoView(focusedItemId, 'nearest');
    }
  }, [focusedItemId, scrollRowIntoView]);

  // Listen for the global context-menu shortcut and open the menu for the right story.
  // Prefer the currently focused tree item; fall back to the selected story when focus is outside
  // the tree. RAC sets data-focused="true" on the focused row, and we track the current story with a ref.
  useEffect(() => {
    if (!api) {
      return;
    }
    let rafId: number | null = null;
    const handler = () => {
      // The event is broadcast to every tree (one per composed ref). Fall back to this
      // tree's selected story only when no tree row has DOM focus anywhere, or the tree
      // owning the focused row and the tree owning the selection would both open a menu.
      const focusInAnyTree = !!document.activeElement?.closest('[data-item-id]');
      const itemId =
        focusedItemIdRef.current ?? (focusInAnyTree ? null : selectedStoryIdRef.current);
      if (!itemId) {
        return;
      }
      // The popover anchors to the row's ⋯ button and is positioned once, on open, so an
      // out-of-view target is first scrolled into view — virtualized rows mount only near
      // the viewport — and the menu opens once the row has had a frame to mount.
      const scroller = containerRef.current;
      const row = scroller?.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`);
      const rowRect = row?.getBoundingClientRect();
      const scrollerRect = scroller?.getBoundingClientRect();
      if (
        rowRect &&
        scrollerRect &&
        rowRect.top >= scrollerRect.top &&
        rowRect.bottom <= scrollerRect.bottom
      ) {
        openContextMenu(itemId, 'keyboard');
        return;
      }
      if (row) {
        row.scrollIntoView({ block: 'center' });
      } else {
        scrollRowIntoView(itemId, 'center');
      }
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          openContextMenu(itemId, 'keyboard');
        });
      });
    };
    api.on(SIDEBAR_OPEN_CONTEXT_MENU, handler);
    return () => {
      api.off(SIDEBAR_OPEN_CONTEXT_MENU, handler);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [api, openContextMenu, scrollRowIntoView]);

  // Scroll the selected story into view when it changes. Newly selected rows may not be in
  // the DOM yet (their ancestors expand in the same commit but only render on the next one),
  // so retry on expansion changes until the row exists — but never re-scroll for the same
  // selection once it succeeded.
  const lastScrolledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedStoryId || lastScrolledIdRef.current === selectedStoryId) {
      return;
    }
    if (scrollRowIntoView(selectedStoryId, 'nearest')) {
      lastScrolledIdRef.current = selectedStoryId;
    }
  }, [selectedStoryId, expanded, scrollRowIntoView]);

  // Center the selected story once when the tree mounts with a selection (deep links).
  // A selection made after a selection-less mount is a user click on a visible row, where
  // a center-scroll would yank the row out from under the cursor.
  const hadInitialSelectionRef = useRef(selectedStoryId != null);
  const [mountCounter, setMountCounter] = useState(0);
  useEffect(() => setMountCounter(1), []);
  useEffect(() => {
    if (mountCounter !== 1) {
      return;
    }
    if (!hadInitialSelectionRef.current) {
      setMountCounter(2);
      return;
    }
    if (selectedStoryId && scrollRowIntoView(selectedStoryId, 'center')) {
      lastScrolledIdRef.current = selectedStoryId;
      setMountCounter(2);
    }
  }, [mountCounter, selectedStoryId, expanded, scrollRowIntoView]);

  // One dependencies array shared by every Collection level, so react-aria's cached nodes are
  // invalidated consistently — a drifted copy at one level renders stale rows. Deliberately
  // minimal: invalidating the collection re-renders every row in the tree, which takes seconds
  // on fully-expanded trees. Selection and context-menu state reach rows through RowUiContext
  // (subscription store) instead, and statuses through StatusContext. hasTestProviders is
  // baked into cached row elements, so it must invalidate them when a provider registers.
  const collectionDependencies = useMemo(
    () => [expanded, hasTestProviders],
    [expanded, hasTestProviders]
  );

  // Feed interaction state to rows without re-rendering the tree: only rows whose derived
  // value changes re-render (see RowUiContext).
  const rowUiStoreRef = useRef<ReturnType<typeof createRowUiStore> | null>(null);
  rowUiStoreRef.current ??= createRowUiStore();
  useEffect(() => {
    rowUiStoreRef.current!.setState({ selectedParentId, contextMenu: contextMenuState });
  }, [selectedParentId, contextMenuState]);

  // Memoize renderNode's returned closure so Collection receives a stable children prop
  // as long as the relevant inputs are stable.
  const nodeRenderer = useMemo(
    () =>
      renderNode({
        api,
        refId,
        onSelectStoryId,
        expanded,
        gapIds: flatRows.gapIds,
        openContextMenu,
        closeContextMenu,
        hasTestProviders,
        collectionDependencies,
      }),
    [
      api,
      refId,
      onSelectStoryId,
      expanded,
      flatRows.gapIds,
      openContextMenu,
      closeContextMenu,
      hasTestProviders,
      collectionDependencies,
    ]
  );

  // Rows are fixed-height except section starts, which carry the gap as padding; the layout
  // measures rendered rows against this estimate.
  const treeLayout = useMemo(() => new ListLayout({ estimatedRowHeight: TREE_ROW_HEIGHT }), []);

  // Memoized so unrelated Tree re-renders (focus tracking, context-menu state) don't re-render
  // every TreeNode through the context.
  const statusContextValue = useMemo(
    () => ({ data, allStatuses, groupDualStatus, isModifiedFilterActive }),
    [data, allStatuses, groupDualStatus, isModifiedFilterActive]
  );

  // TODO: consider passing more data via the provider to limit prop drilling in renderNode? Any advantage?
  return (
    <StatusContext.Provider value={statusContextValue}>
      <RowUiContext.Provider value={rowUiStoreRef.current}>
        <TreeWrapper>
          <Virtualizer layout={treeLayout}>
            <StyledAriaTree
              ref={containerRef}
              aria-label="Stories"
              selectionMode="single"
              // With the default 'toggle' behavior react-aria treats Enter as a no-op while a
              // selection exists; 'replace' keeps Enter firing onAction on every row.
              selectionBehavior="replace"
              expandedKeys={expanded}
              onExpandedChange={handleExpandedChange}
              selectedKeys={selectedKeys}
              onSelectionChange={handleSelectionChange}
              onAction={handleAction}
            >
              <Collection items={tree} dependencies={collectionDependencies}>
                {nodeRenderer}
              </Collection>
            </StyledAriaTree>
          </Virtualizer>
          {pinnedIds.length > 0 && (
            // Purely a pointer affordance: the real rows carry the accessible tree semantics,
            // so the overlay stays out of the tab order and the accessibility tree.
            <PinnedOverlay data-testid="sticky-overlay" aria-hidden="true">
              {pinnedIds.map((id, overlayIndex) => {
                const entry = collapsedData[id];
                if (!entry) {
                  return null;
                }
                const level = entry.type === 'root' ? 0 : (entry.depth ?? 0);
                return (
                  <PinnedRow
                    key={id}
                    $level={level}
                    data-pinned-item-id={id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => scrollPinnedRowIntoPlace(id, overlayIndex)}
                  >
                    <PinnedTraceAnchor $level={level}>
                      <Traces level={level} isAlongsideSelected={false} />
                    </PinnedTraceAnchor>
                    <PinnedRowIcon
                      data-testid="pinned-collapse"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpanded({ ids: [id], append: true, value: false });
                        scrollPinnedRowIntoPlace(id, overlayIndex);
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
                    </PinnedRowIcon>
                    <PinnedLabel>
                      {entry.renderLabel?.(entry, api, labelContext) || entry.name}
                    </PinnedLabel>
                  </PinnedRow>
                );
              })}
              {(() => {
                // Bridge the deepest pinned row's ancestor lines through the fade. The deepest
                // level itself has no parent line above to continue, so it is excluded (a lone
                // pinned root, level 0, draws no line at all).
                const lastEntry = collapsedData[pinnedIds[pinnedIds.length - 1]];
                const deepestLevel = lastEntry
                  ? lastEntry.type === 'root'
                    ? 0
                    : (lastEntry.depth ?? 0)
                  : 0;
                return deepestLevel > 0 ? (
                  <PinnedFadeBridge $level={deepestLevel} data-pinned-bridge>
                    <Traces level={deepestLevel} isAlongsideSelected={false} />
                  </PinnedFadeBridge>
                ) : null;
              })()}
            </PinnedOverlay>
          )}
        </TreeWrapper>
        {supportsAnchorPositioning && focusedItemShortcutLabel && (
          <FocusTooltipNote note={focusedItemShortcutLabel} shortcut={contextMenuShortcut} />
        )}
      </RowUiContext.Provider>
    </StatusContext.Provider>
  );
});

// Stable module-level constant so empty-state props don't bust React.memo equality checks.
const EMPTY_KEYS: Set<string> = new Set();

function shallowEqualRecords(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
}

/** Reuse the previous object identity while its entries are shallow-equal (same value refs). */
function useStableIdentity<T extends Record<string, any> | undefined>(value: T): T {
  const ref = useRef(value);
  if (ref.current !== value && !shallowEqualRecords(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

interface RenderNodeProps extends Pick<TreeNodeProps, 'api' | 'refId' | 'onSelectStoryId'> {
  expanded: Set<string>;
  /** Section-start rows that carry the inter-section gap as padding. */
  gapIds: Set<string>;
  openContextMenu: NonNullable<TreeNodeProps['openContextMenu']>;
  closeContextMenu: NonNullable<TreeNodeProps['closeContextMenu']>;
  hasTestProviders: boolean;
  /** Shared with every Collection level so react-aria invalidates its node cache consistently. */
  collectionDependencies: unknown[];
}

function renderNode({
  expanded,
  gapIds,
  openContextMenu,
  closeContextMenu,
  hasTestProviders,
  collectionDependencies,
  ...props
}: RenderNodeProps) {
  const renderNodeLevel = (item: TreeEntry) => {
    return (
      <TreeNode
        {...props}
        key={item.id}
        item={item}
        isExpanded={expanded.has(item.id)}
        hasSectionGap={gapIds.has(item.id)}
        openContextMenu={openContextMenu}
        closeContextMenu={closeContextMenu}
        hasTestProviders={hasTestProviders}
      >
        {item.resolvedChildren && (
          <Collection items={item.resolvedChildren} dependencies={collectionDependencies}>
            {renderNodeLevel}
          </Collection>
        )}
      </TreeNode>
    );
  };
  return renderNodeLevel;
}
