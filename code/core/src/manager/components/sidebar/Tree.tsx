import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PRELOAD_ENTRIES, SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';
import { TooltipNote } from 'storybook/internal/components';

import { Collection } from 'react-aria-components/Collection';
import { Tree as AriaTree } from 'react-aria-components/Tree';

import {
  type TreeEntry,
  collapseSingleStoryComponents,
  getAncestorIds,
  indexToTree,
} from '../../utils/tree.ts';
import { TreeNode, type TreeNodeProps } from './TreeNode.tsx';

import {
  Addon_TypesEnum,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { useStorybookApi } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import type { IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getGroupDualStatus } from '../../utils/status.tsx';
import { useExpanded } from './useExpanded.ts';
import { StatusContext } from './StatusContext.tsx';
import { RowUiContext, createRowUiStore } from './RowUiContext.tsx';
import { generateTestProviderLinks, hasContextMenu } from './ContextMenu.tsx';

// FIXME/TODO: Review with MA: should clicking on a story with children also navigate to it?
// -> Add a "Story" item in the tree, or get a commitment from the team to remove .test
// FIXME/TODO: Tree is no longer showing the section animation on F6 after an item is focused
// FIXME/TODO: add a level for trees with a RefHead.

const StyledAriaTree = styled(AriaTree)(() => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  outline: 'none',
  // Contain the sticky rows' z-index so overlay UI outside the tree (Radix scrollbar,
  // the focus tooltip) still paints above pinned rows.
  isolation: 'isolate' as const,

  // Show trace lines on hover or keyboard focus.
  '&:hover, &:has(:focus-visible)': {
    '--trace-opacity': 1,
  },

  // Add spacing between top-level expanded subtree and its next sibling.
  '*[data-level]:not([data-level="1"]) + *[data-level="1"]': {
    marginTop: 14,
  },
}));

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
  isBrowsing: boolean;
  isMain: boolean;
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
  // 'pointer' = click on the ⋯ button; 'keyboard' = global shortcut (shows extra actions).
  const [contextMenuState, setContextMenuState] = useState<{
    itemId: string;
    entryMethod: 'pointer' | 'keyboard';
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

  // Open or close the context menu. Stable callback for children.
  const openContextMenu = useCallback((itemId: string, entryMethod: 'pointer' | 'keyboard') => {
    setContextMenuState({ itemId, entryMethod });
  }, []);
  const closeContextMenu = useCallback(() => setContextMenuState(null), []);

  // Listen for the global context-menu shortcut and open the menu for the right story.
  // Prefer the currently focused tree item; fall back to the selected story when focus is outside
  // the tree. RAC sets data-focused="true" on the focused row, and we track the current story with a ref.
  useEffect(() => {
    if (!api) {
      return;
    }
    const handler = () => {
      const itemId = focusedItemIdRef.current ?? selectedStoryIdRef.current;
      if (itemId) {
        openContextMenu(itemId, 'keyboard');
      }
    };
    api.on(SIDEBAR_OPEN_CONTEXT_MENU, handler);
    return () => {
      api.off(SIDEBAR_OPEN_CONTEXT_MENU, handler);
    };
  }, [api, openContextMenu]);

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
          (mutation.attributeName === 'data-focused' ||
            mutation.attributeName === 'data-focus-visible') &&
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

  // VSCode-style sticky scroll: pin the ancestor chain of the topmost visible row (plus that
  // row itself while its own subtree continues below it), stacked in order. Membership follows
  // the viewport (not the selection): a chain stays pinned until the next subtree's rows reach
  // the top of the viewport, and leaf rows are never pinned. Rows are marked with
  // data-sticky-pinned + a --sticky-top slot; CSS position:sticky does the actual
  // pinning/unpinning as rows cross their slot, which is what makes branches pin as soon as
  // they are partially hidden. Runs rAF-throttled on scroll and resize, and whenever the
  // expansion state or data changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const doc = container.ownerDocument;
    const win = doc.defaultView;
    // Fall back to the document scroller so pinned rows still work in unusual embeddings.
    const scroller = getScrollParent(container) ?? (doc.scrollingElement as HTMLElement | null);
    if (!scroller || !win) {
      return;
    }
    const scrollEventTarget: EventTarget = scroller === doc.scrollingElement ? win : scroller;

    let rafId: number | null = null;
    // Rows currently owned by the sticky controller, tracked for exact cleanup so no stale
    // pin state (attribute, slot offset) survives navigation or data changes.
    const pinnedRows = new Set<HTMLElement>();

    const clearRow = (row: HTMLElement) => {
      row.removeAttribute('data-sticky-pinned');
      row.style.removeProperty('--sticky-top');
      pinnedRows.delete(row);
    };

    const clearAll = () => {
      for (const row of [...pinnedRows]) {
        clearRow(row);
      }
    };

    // Natural row geometry — positions measured with pinning disabled, relative to the
    // container, cached until the DOM or layout changes. Chain membership is derived from
    // natural positions only, never from which rows are currently stuck: deriving it from the
    // engaged stack feeds the stack height back into the boundary, which oscillates when a
    // subtree's last rows have less than the stack's height of room (parent pins → covers the
    // leaf → boundary moves → parent unpins → leaf reappears → parent pins again, every frame).
    interface RowGeometry {
      rows: HTMLElement[];
      ids: (string | null)[];
      tops: number[];
      bottoms: number[];
      indexById: Map<string, number>;
    }
    let geometry: RowGeometry | null = null;
    const measureGeometry = (): RowGeometry => {
      if (geometry) {
        return geometry;
      }
      const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-item-id]'));
      container.toggleAttribute('data-sticky-measuring', true);
      const containerTop = container.getBoundingClientRect().top;
      const ids: (string | null)[] = [];
      const tops: number[] = [];
      const bottoms: number[] = [];
      const indexById = new Map<string, number>();
      rows.forEach((row, i) => {
        const rect = row.getBoundingClientRect();
        const id = row.getAttribute('data-item-id');
        ids.push(id);
        tops.push(rect.top - containerTop);
        bottoms.push(rect.bottom - containerTop);
        if (id) {
          indexById.set(id, i);
        }
      });
      container.removeAttribute('data-sticky-measuring');
      geometry = { rows, ids, tops, bottoms, indexById };
      return geometry;
    };
    const rowsObserver = new win.MutationObserver(() => {
      geometry = null;
      scheduleUpdate();
    });
    rowsObserver.observe(container, { childList: true, subtree: true });

    const update = () => {
      rafId = null;
      const { rows, ids, tops, bottoms, indexById } = measureGeometry();
      if (rows.length === 0) {
        clearAll();
        return;
      }

      // The viewport's top line in the tree's natural coordinates. The container itself never
      // pins, so its rect is always the natural one.
      const scrollerTop =
        scroller === doc.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
      const targetY = scrollerTop - container.getBoundingClientRect().top;

      // Top row: the row the viewport's top line passes through (or the next one, when the
      // line falls in a section gap). This keeps the current chain pinned until the next
      // subtree's rows actually reach the top of the viewport.
      let lo = 0;
      let hi = rows.length - 1;
      let topIndex = rows.length;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (bottoms[mid] <= targetY) {
          lo = mid + 1;
        } else {
          topIndex = mid;
          hi = mid - 1;
        }
      }
      if (topIndex >= rows.length) {
        // Scrolled past this tree entirely.
        clearAll();
        return;
      }
      const topId = ids[topIndex];
      if (!topId) {
        clearAll();
        return;
      }

      // Desired stack: the top row's strict ancestors, root-most first. Copy before reversing:
      // getAncestorIds returns a memoized array.
      const chainIds = [...getAncestorIds(collapsedDataRef.current, topId)].reverse();
      // The top row itself joins the stack while its own subtree continues below it, so a
      // branch pins the moment it is partially hidden (by the stack above it, or the viewport
      // for top-level rows) instead of popping in only once fully scrolled past. Leaves and
      // collapsed branches never qualify: the row after them is not their descendant.
      const nextId = ids[topIndex + 1];
      if (nextId && getAncestorIds(collapsedDataRef.current, nextId).includes(topId)) {
        chainIds.push(topId);
      }
      const desired: { row: HTMLElement; height: number }[] = [];
      for (const id of chainIds) {
        const index = indexById.get(id);
        if (index !== undefined) {
          desired.push({ row: rows[index], height: bottoms[index] - tops[index] });
        }
      }

      // Write phase: release rows that left the stack, then (re)assign slots top-down.
      // All writes are change-guarded: redundant attribute/property writes would invalidate
      // styles every frame while scrolling.
      const desiredSet = new Set(desired.map(({ row }) => row));
      for (const row of [...pinnedRows]) {
        if (!desiredSet.has(row) || !row.isConnected) {
          clearRow(row);
        }
      }
      let cumulativeTop = 0;
      for (const { row, height } of desired) {
        if (!row.hasAttribute('data-sticky-pinned')) {
          row.setAttribute('data-sticky-pinned', '');
        }
        const slot = `${cumulativeTop}px`;
        if (row.style.getPropertyValue('--sticky-top') !== slot) {
          row.style.setProperty('--sticky-top', slot);
        }
        pinnedRows.add(row);
        cumulativeTop += height;
      }
    };

    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    scrollEventTarget.addEventListener('scroll', scheduleUpdate, { passive: true });

    // Content can move without a scroll event (a sibling ref tree loading or collapsing,
    // window resizes); those shifts also invalidate the measured natural geometry.
    const resizeObserver =
      typeof win.ResizeObserver === 'function'
        ? new win.ResizeObserver(() => {
            geometry = null;
            scheduleUpdate();
          })
        : null;
    resizeObserver?.observe(scroller);
    if (scroller.firstElementChild) {
      resizeObserver?.observe(scroller.firstElementChild);
    }

    return () => {
      scrollEventTarget.removeEventListener('scroll', scheduleUpdate);
      resizeObserver?.disconnect();
      rowsObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      clearAll();
    };
  }, [expanded, collapsedData]);

  // Scroll a row into view from its natural (unpinned) layout position. Pinned chain rows
  // report their stuck rect, which would fool scrollIntoView into thinking a row far above
  // the viewport is already visible; data-sticky-measuring temporarily disables pinning while
  // the browser measures, and a temporary scroll-margin-top (the prospective stack height)
  // keeps the target row below the stack.
  const scrollRowIntoView = useCallback((itemId: string, block: ScrollLogicalPosition): boolean => {
    const container = containerRef.current;
    if (!container) {
      return false;
    }
    const element = container.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(itemId)}"]`);
    if (!element) {
      return false;
    }
    // After the scroll, the target's own ancestors will pin above it; reserve their combined
    // height (not the current stack's) so the row lands fully below the future stack.
    const prospectiveStack = getAncestorIds(collapsedDataRef.current, itemId).reduce(
      (height, ancestorId) => {
        const row = container.querySelector<HTMLElement>(
          `[data-item-id="${CSS.escape(ancestorId)}"]`
        );
        return height + (row?.offsetHeight ?? 0);
      },
      0
    );
    container.toggleAttribute('data-sticky-measuring', true);
    element.style.scrollMarginTop = `${prospectiveStack}px`;
    try {
      element.scrollIntoView({ block });
    } finally {
      element.style.removeProperty('scroll-margin-top');
      container.removeAttribute('data-sticky-measuring');
    }
    return true;
  }, []);

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

  // Scroll to selected item on the first mount, exactly one time.
  const [mountCounter, setMountCounter] = useState(0);
  useEffect(() => setMountCounter(1), []);
  useEffect(() => {
    if (mountCounter === 1 && selectedStoryId && scrollRowIntoView(selectedStoryId, 'center')) {
      lastScrolledIdRef.current = selectedStoryId;
      setMountCounter(2);
    }
  }, [mountCounter, selectedStoryId, expanded, scrollRowIntoView]);

  // One dependencies array shared by every Collection level, so react-aria's cached nodes are
  // invalidated consistently — a drifted copy at one level renders stale rows. Deliberately
  // minimal: invalidating the collection re-renders every row in the tree, which takes seconds
  // on fully-expanded trees. Selection and context-menu state reach rows through RowUiContext
  // (subscription store) instead, and statuses through StatusContext.
  const collectionDependencies = useMemo(() => [expanded], [expanded]);

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
      openContextMenu,
      closeContextMenu,
      hasTestProviders,
      collectionDependencies,
    ]
  );

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
        <StyledAriaTree
          ref={containerRef}
          aria-label="Stories"
          selectionMode="single"
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
        {focusedItemShortcutLabel && (
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

/** Find the nearest scrollable ancestor (the element sticky rows pin to). */
function getScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

interface RenderNodeProps extends Pick<TreeNodeProps, 'api' | 'refId' | 'onSelectStoryId'> {
  expanded: Set<string>;
  openContextMenu: NonNullable<TreeNodeProps['openContextMenu']>;
  closeContextMenu: NonNullable<TreeNodeProps['closeContextMenu']>;
  hasTestProviders: boolean;
  /** Shared with every Collection level so react-aria invalidates its node cache consistently. */
  collectionDependencies: unknown[];
}

function renderNode({
  expanded,
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
