import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';
import { TooltipNote } from 'storybook/internal/components';

import { Collection } from 'react-aria-components/Collection';
import { Tree as AriaTree } from 'react-aria-components/Tree';

import { type TreeEntry, collapseSingleStoryComponents, indexToTree } from '../../utils/tree.ts';
import { TreeNode, type TreeNodeProps } from './TreeNode.tsx';

import { type StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { useStorybookApi } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import type { IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getGroupDualStatus } from '../../utils/status.tsx';
import { useExpanded } from './useExpanded.ts';
import { StatusContext } from './StatusContext.tsx';
import { hasContextMenu } from './ContextMenu.tsx';

// FIXME/TODO: Review with MA: should clicking on a story with children also navigate to it?
// -> Add a "Story" item in the tree, or get a commitment from the team to remove .test
// FIXME/TODO: implement sticky breadcrumbs
// FIXME/TODO: Tree is no longer showing the section animation on F6 after an item is focused
// FIXME/TODO: add a level for trees with a RefHead.

const StyledAriaTree = styled(AriaTree)(() => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  outline: 'none',

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
  refId: string;
  data: IndexHash;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}

export const Tree = React.memo<TreeProps>(function Tree({
  allStatuses,
  refId,
  data,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();

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

    if (!hasContextMenu(item)) {
      return null;
    }

    const itemStatus = groupDualStatus?.[focusedItemId];
    const changeStatus = itemStatus?.change.value ?? 'status-value:unknown';
    const testStatus = itemStatus?.test.value ?? 'status-value:unknown';

    return changeStatus !== 'status-value:unknown' || testStatus !== 'status-value:unknown'
      ? 'Status and actions'
      : 'Actions';
  }, [focusedItemId, contextMenuShortcut, collapsedData, groupDualStatus]);

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

  // Scroll the selected story into view when it changes.
  useEffect(() => {
    if (selectedStoryId && containerRef.current) {
      const element = containerRef.current.querySelector(
        `[data-item-id="${CSS.escape(selectedStoryId)}"]`
      );
      if (element) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedStoryId]);

  // Scroll to selected item on the first mount, exactly one time.
  const [mountCounter, setMountCounter] = useState(0);
  useEffect(() => setMountCounter(1), []);
  useEffect(() => {
    if (mountCounter === 1 && selectedStoryId && containerRef.current) {
      const element = containerRef.current.querySelector(
        `[data-item-id="${CSS.escape(selectedStoryId)}"]`
      );
      if (element) {
        element.scrollIntoView({ block: 'center' });
        setMountCounter(2);
      }
    }
  }, [mountCounter, selectedStoryId]);

  // Memoize renderNode's returned closure so Collection receives a stable children prop
  // as long as the relevant inputs are stable.
  const nodeRenderer = useMemo(
    () =>
      renderNode({
        api,
        refId,
        onSelectStoryId,
        selectedStoryId,
        selectedParentId,
        expanded,
        contextMenuState,
        openContextMenu,
        closeContextMenu,
      }),
    [
      api,
      refId,
      onSelectStoryId,
      selectedStoryId,
      selectedParentId,
      expanded,
      contextMenuState,
      openContextMenu,
      closeContextMenu,
    ]
  );

  // TODO: consider passing more data via the provider to limit prop drilling in renderNode? Any advantage?
  return (
    <StatusContext.Provider value={{ data, allStatuses, groupDualStatus }}>
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
        <Collection
          items={tree}
          dependencies={[
            expanded,
            selectedStoryId,
            selectedParentId,
            contextMenuState,
            groupDualStatus,
          ]}
        >
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

interface RenderNodeProps extends Pick<TreeNodeProps, 'api' | 'refId' | 'onSelectStoryId'> {
  selectedStoryId: string | null;
  selectedParentId: string | null;
  expanded: Set<string>;
  contextMenuState: { itemId: string; entryMethod: 'pointer' | 'keyboard' } | null;
  openContextMenu: NonNullable<TreeNodeProps['openContextMenu']>;
  closeContextMenu: NonNullable<TreeNodeProps['closeContextMenu']>;
}

function renderNode({
  expanded,
  selectedStoryId,
  selectedParentId,
  contextMenuState,
  openContextMenu,
  closeContextMenu,
  ...props
}: RenderNodeProps) {
  const renderNodeLevel = (item: TreeEntry) => {
    return (
      <TreeNode
        {...props}
        key={item.id}
        item={item}
        isOrphan={item.depth === 0 && item.type !== 'root'}
        isExpanded={expanded.has(item.id)}
        isSelected={selectedStoryId === item.id}
        isAlongsideSelected={item.type !== 'root' && selectedParentId === item.parent}
        isContextMenuOpen={contextMenuState?.itemId === item.id}
        contextMenuEntryMethod={
          contextMenuState?.itemId === item.id ? contextMenuState.entryMethod : undefined
        }
        openContextMenu={openContextMenu}
        closeContextMenu={closeContextMenu}
      >
        {item.resolvedChildren && (
          <Collection
            items={item.resolvedChildren}
            dependencies={[expanded, selectedStoryId, selectedParentId, contextMenuState]}
          >
            {renderNode({
              ...props,
              expanded,
              selectedStoryId,
              selectedParentId,
              contextMenuState,
              openContextMenu,
              closeContextMenu,
            })}
          </Collection>
        )}
      </TreeNode>
    );
  };
  return renderNodeLevel;
}
