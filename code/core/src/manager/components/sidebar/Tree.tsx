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
  allStatuses,
  includedStatusFilters,
  refId,
  data,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();
  const isModifiedFilterActive = (includedStatusFilters ?? []).includes('status-value:modified');
  // Whether any test provider is registered: gates the context menu on group/component rows.
  const hasTestProviders =
    Object.keys(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER)).length > 0;

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

  // Sticky chain (VSCode-style sticky scroll): the selected node's ancestor chain, root-most
  // first, plus the selected node itself. These rows pin below one another while scrolling
  // through their subtree; leaf rows never effectively pin because their subtree ends with
  // themselves (see the suspension effect below).
  const stickyChainIds = useMemo<string[]>(() => {
    if (!selectedStoryId || !collapsedData[selectedStoryId]) {
      return EMPTY_STICKY_CHAIN;
    }
    // Copy before reversing: getAncestorIds returns a memoized array.
    return [...getAncestorIds(collapsedData, selectedStoryId)].reverse().concat(selectedStoryId);
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

  // Keep the sticky stack in sync with the scroll position: suspend stickiness for chain rows
  // whose subtree has fully scrolled past their pinned slot (so the stack retracts instead of
  // lingering over unrelated sections, mirroring VSCode's sticky scroll), pin each row below
  // the measured height of the rows above it, and expose the stack height so scroll-into-view
  // can keep targets out from underneath the stack. Runs rAF-throttled on scroll and resize,
  // and whenever the chain, expansion state, or data changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (stickyChainIds.length === 0) {
      container.style.removeProperty('--sticky-stack-height');
      return;
    }

    const doc = container.ownerDocument;
    const win = doc.defaultView;
    // Fall back to the document scroller so pinned rows still retract in unusual embeddings.
    const scroller = getScrollParent(container) ?? (doc.scrollingElement as HTMLElement | null);
    if (!scroller || !win) {
      return;
    }
    const scrollEventTarget: EventTarget = scroller === doc.scrollingElement ? win : scroller;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const scrollerTop =
        scroller === doc.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
      const allRows = Array.from(container.querySelectorAll<HTMLElement>('[data-item-id]'));
      const rowIndexById = new Map(
        allRows.map((row, index) => [row.getAttribute('data-item-id'), index] as const)
      );

      // Read phase: measure every chain row and its subtree end before any attribute/style
      // write, so the frame forces at most one layout pass.
      const measured = stickyChainIds.map((id) => {
        const index = rowIndexById.get(id);
        const row = index === undefined ? undefined : allRows[index];
        if (!row || index === undefined) {
          return null;
        }
        return {
          row,
          height: row.offsetHeight,
          subtreeEnd: getSubtreeEndPosition(container, allRows, index),
        };
      });

      // Write phase.
      let stackHeight = 0;
      for (const measurement of measured) {
        if (!measurement) {
          continue;
        }
        const { row, height, subtreeEnd } = measurement;
        // The row stays pinned as long as part of its subtree is below its pinned slot.
        const isActive = subtreeEnd - scrollerTop > stackHeight + height;
        row.toggleAttribute('data-sticky-suspended', !isActive);
        if (isActive) {
          // Pin below the measured stack rather than the TREE_ROW_HEIGHT estimate baked into
          // the CSS, so rows taller than the estimate (custom labels, zoom) never overlap.
          const top = `${stackHeight}px`;
          if (row.style.top !== top) {
            row.style.top = top;
          }
          stackHeight += height;
        }
      }
      container.style.setProperty('--sticky-stack-height', `${stackHeight}px`);
    };

    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    scrollEventTarget.addEventListener('scroll', scheduleUpdate, { passive: true });

    // Content can move without a scroll event (a sibling ref tree loading or collapsing,
    // window resizes); watch the scroller and its content wrapper to catch those shifts.
    const resizeObserver =
      typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(scroller);
    if (scroller.firstElementChild) {
      resizeObserver?.observe(scroller.firstElementChild);
    }

    return () => {
      scrollEventTarget.removeEventListener('scroll', scheduleUpdate);
      resizeObserver?.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      // Leave --sticky-stack-height in place: React runs this cleanup before sibling effects
      // (like the selection scroll) on the same commit, and those need the current stack
      // height for scroll margins. update() refreshes it right after; the no-chain path
      // clears it for good.
      for (const id of stickyChainIds) {
        const row = container.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
        row?.removeAttribute('data-sticky-suspended');
        row?.style.removeProperty('--sticky-top');
      }
    };
  }, [stickyChainIds, expanded, collapsedData]);

  // Scroll a row into view from its natural (unpinned) layout position. Pinned chain rows
  // report their stuck rect, which would fool scrollIntoView into thinking a row far above
  // the viewport is already visible; data-sticky-measuring temporarily disables pinning while
  // the browser measures, and the rows' scroll-margin-top (the pinned stack height) keeps the
  // target row below the stack.
  const scrollRowIntoView = useCallback((itemId: string, block: ScrollLogicalPosition): boolean => {
    const container = containerRef.current;
    if (!container) {
      return false;
    }
    const element = container.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(itemId)}"]`);
    if (!element) {
      return false;
    }
    container.toggleAttribute('data-sticky-measuring', true);
    try {
      element.scrollIntoView({ block });
    } finally {
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
  // invalidated consistently — a drifted copy at one level renders stale rows.
  const collectionDependencies = useMemo(
    () => [
      expanded,
      selectedStoryId,
      selectedParentId,
      contextMenuState,
      groupDualStatus,
      stickyChainIds,
    ],
    [expanded, selectedStoryId, selectedParentId, contextMenuState, groupDualStatus, stickyChainIds]
  );

  // Memoize renderNode's returned closure so Collection receives a stable children prop
  // as long as the relevant inputs are stable.
  const nodeRenderer = useMemo(
    () =>
      renderNode({
        api,
        refId,
        onSelectStoryId,
        selectedParentId,
        expanded,
        contextMenuState,
        openContextMenu,
        closeContextMenu,
        stickyChainIds,
        hasTestProviders,
        collectionDependencies,
      }),
    [
      api,
      refId,
      onSelectStoryId,
      selectedParentId,
      expanded,
      contextMenuState,
      openContextMenu,
      closeContextMenu,
      stickyChainIds,
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
    </StatusContext.Provider>
  );
});

// Stable module-level constants so empty-state props don't bust React.memo equality checks.
const EMPTY_KEYS: Set<string> = new Set();
const EMPTY_STICKY_CHAIN: string[] = [];

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

/**
 * Viewport position of the end of a row's subtree: the top of the next row at the same or a
 * shallower level (react-aria renders tree rows flat, in document order, with `data-level`), or
 * the bottom of the tree when the subtree runs to the end.
 */
function getSubtreeEndPosition(
  container: HTMLElement,
  allRows: HTMLElement[],
  rowIndex: number
): number {
  const level = Number(allRows[rowIndex].getAttribute('data-level') ?? '1');
  for (let i = rowIndex + 1; i < allRows.length; i++) {
    if (Number(allRows[i].getAttribute('data-level') ?? '1') <= level) {
      return allRows[i].getBoundingClientRect().top;
    }
  }
  return container.getBoundingClientRect().bottom;
}

interface RenderNodeProps extends Pick<TreeNodeProps, 'api' | 'refId' | 'onSelectStoryId'> {
  selectedParentId: string | null;
  expanded: Set<string>;
  contextMenuState: { itemId: string; entryMethod: 'pointer' | 'keyboard' } | null;
  openContextMenu: NonNullable<TreeNodeProps['openContextMenu']>;
  closeContextMenu: NonNullable<TreeNodeProps['closeContextMenu']>;
  stickyChainIds: string[];
  hasTestProviders: boolean;
  /** Shared with every Collection level so react-aria invalidates its node cache consistently. */
  collectionDependencies: unknown[];
}

function renderNode({
  expanded,
  selectedParentId,
  contextMenuState,
  openContextMenu,
  closeContextMenu,
  stickyChainIds,
  hasTestProviders,
  collectionDependencies,
  ...props
}: RenderNodeProps) {
  const stickyIndexById = new Map(stickyChainIds.map((id, index) => [id, index] as const));

  const renderNodeLevel = (item: TreeEntry) => {
    return (
      <TreeNode
        {...props}
        key={item.id}
        item={item}
        isExpanded={expanded.has(item.id)}
        isAlongsideSelected={item.type !== 'root' && selectedParentId === item.parent}
        isContextMenuOpen={contextMenuState?.itemId === item.id}
        contextMenuEntryMethod={
          contextMenuState?.itemId === item.id ? contextMenuState.entryMethod : undefined
        }
        openContextMenu={openContextMenu}
        closeContextMenu={closeContextMenu}
        hasTestProviders={hasTestProviders}
        stickyIndex={stickyIndexById.get(item.id)}
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
