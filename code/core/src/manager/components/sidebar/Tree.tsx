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
import { SECTION_GAP, TREE_ROW_HEIGHT, TreeNode, type TreeNodeProps } from './TreeNode.tsx';

import {
  Addon_TypesEnum,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { useStorybookApi } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import type { IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';
import { getGroupDualStatus } from '../../utils/status.tsx';
import { useExpanded } from './useExpanded.ts';
import { StatusContext } from './StatusContext.tsx';
import { RowUiContext, createRowUiStore } from './RowUiContext.tsx';
import { CollapseIcon } from './CollapseIcon.tsx';
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
  // The virtualizer makes the tree its own scroll container; the parent must bound its height.
  height: '100%',
  overflow: 'auto',

  // Show trace lines on hover or keyboard focus.
  '&:hover, &:has(:focus-visible)': {
    '--trace-opacity': 1,
  },
}));

const TreeWrapper = styled.div({
  position: 'relative',
  height: '100%',
  minHeight: 0,
  // Contain the overlay's z-index so UI outside the tree still paints above it.
  isolation: 'isolate',
});

const PinnedOverlay = styled.div(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 3,
  '--sticky-bg': theme.background.content,
  [MEDIA_DESKTOP_BREAKPOINT]: {
    '--sticky-bg': theme.background.app,
  },
}));

const PinnedRow = styled.button<{ $level: number }>(({ $level, theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: TREE_ROW_HEIGHT,
  border: 0,
  margin: 0,
  paddingBlock: 0,
  paddingInlineEnd: 0,
  paddingInlineStart: `calc(${$level} * 20px + 7px)`,
  gap: 6,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: theme.color.defaultText,
  backgroundColor: 'var(--sticky-bg)',
  '&:hover': {
    backgroundImage: `linear-gradient(${theme.background.hoverable}, ${theme.background.hoverable})`,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: -2,
  },
  '& svg': {
    flexShrink: 0,
  },
  '& > span': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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

  // Flattened visible rows in render order, with arithmetic geometry. The tree is
  // virtualized, so most rows have no DOM node to measure: positions derive from the fixed
  // row height plus the deterministic section gap (mirrored in TreeNode's padding rule).
  const flatRows = useMemo(() => {
    const ids: string[] = [];
    const gapIds = new Set<string>();
    const offsets: number[] = [];
    const indexById = new Map<string, number>();
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
      }
    };
    walk(tree, 1);
    return { ids, gapIds, offsets, indexById, totalHeight: y };
  }, [tree, expanded]);
  const flatRowsRef = useRef(flatRows);
  flatRowsRef.current = flatRows;

  // VSCode-style sticky scroll, rendered as an overlay above the virtualized scroller (CSS
  // position:sticky cannot work on virtualized, absolutely-positioned rows). The chain is the
  // strict ancestors of the row at the viewport's top line, plus that row itself while its own
  // subtree continues below it; it stays pinned until the next subtree's rows reach the top.
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  useEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) {
      return;
    }
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const { ids, offsets, indexById } = flatRowsRef.current;
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
        // Only chain rows that are actually above their slot pin; keep the rest natural so a
        // chain root at the top of the viewport is not overlaid by its own copy.
        chainIds = chainIds.filter((id, i) => {
          const index = indexById.get(id);
          return index !== undefined && offsets[index] < targetY + i * TREE_ROW_HEIGHT;
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
    const stack = getAncestorIds(collapsedDataRef.current, itemId).length * TREE_ROW_HEIGHT;
    if (block === 'center') {
      scroller.scrollTop = offset - Math.max((scroller.clientHeight - TREE_ROW_HEIGHT) / 2, stack);
      return true;
    }
    const viewTop = scroller.scrollTop + stack;
    const viewBottom = scroller.scrollTop + scroller.clientHeight - TREE_ROW_HEIGHT;
    if (offset < viewTop || offset > viewBottom) {
      scroller.scrollTop = offset - stack;
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
            <PinnedOverlay data-testid="sticky-overlay">
              {pinnedIds.map((id) => {
                const entry = collapsedData[id];
                if (!entry) {
                  return null;
                }
                return (
                  <PinnedRow
                    key={id}
                    $level={entry.type === 'root' ? 0 : (entry.depth ?? 0)}
                    data-pinned-item-id={id}
                    type="button"
                    onClick={() => scrollRowIntoView(id, 'start')}
                    aria-label={`Scroll to ${entry.name}`}
                  >
                    <CollapseIcon isExpanded />
                    <span>{entry.name}</span>
                  </PinnedRow>
                );
              })}
            </PinnedOverlay>
          )}
        </TreeWrapper>
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
