import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';

import { Collection } from '@react-aria/collections';
import { Tree as AriaTree } from 'react-aria-components/patched-dist/Tree';

import { type TreeEntry, collapseSingleStoryComponents, indexToTree } from '../../utils/tree.ts';
import { TreeNode, type TreeNodeProps } from './TreeNode.tsx';

import {
  type Status,
  type StatusesByStoryIdAndTypeId,
  type StoryId,
} from 'storybook/internal/types';

import { useStorybookApi } from 'storybook/manager-api';
import type { IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getGroupDualStatus } from '../../utils/status.tsx';
import { useExpanded } from './useExpanded.ts';

const StyledAriaTree = styled(AriaTree)(() => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  outline: 'none',

  // Show trace lines on hover or keyboard focus.
  '&:hover, &:has(:focus-visible)': {
    '--trace-opacity': 1,
  },
})) as typeof AriaTree;

interface TreeProps {
  isBrowsing: boolean;
  isDevelopment: boolean;
  isMain: boolean;
  allStatuses?: StatusesByStoryIdAndTypeId;
  refId: string;
  data: IndexHash;
  docsMode: boolean;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}

export const Tree = React.memo<TreeProps>(function Tree({
  isDevelopment,
  allStatuses,
  refId,
  data,
  docsMode,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();

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

  // Listen for the global context-menu shortcut and open the menu for the focused item.
  useEffect(() => {
    if (!api) {
      return;
    }
    const handler = () => {
      console.log('handler');
      const focused = containerRef.current?.querySelector('[data-focused="true"]');
      const itemId = focused?.getAttribute('data-item-id');
      if (itemId) {
        console.log('handled' + itemId);
        openContextMenu(itemId, 'keyboard');
      }
    };
    api.on(SIDEBAR_OPEN_CONTEXT_MENU, handler);
    return () => {
      api.off(SIDEBAR_OPEN_CONTEXT_MENU, handler);
    };
  }, [api, openContextMenu]);

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

  // Memoize renderNode's returned closure so Collection receives a stable children prop
  // as long as the relevant inputs are stable.
  const nodeRenderer = useMemo(
    () =>
      renderNode({
        api,
        refId,
        docsMode,
        isDevelopment,
        groupDualStatus,
        data: collapsedData,
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
      docsMode,
      isDevelopment,
      groupDualStatus,
      collapsedData,
      onSelectStoryId,
      selectedStoryId,
      selectedParentId,
      expanded,
      contextMenuState,
      openContextMenu,
      closeContextMenu,
    ]
  );

  return (
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
  );
});

// Stable module-level constants so empty-state props don't bust React.memo equality checks.
const EMPTY_KEYS: Set<string> = new Set();

interface RenderNodeProps extends Omit<
  TreeNodeProps,
  | 'item'
  | 'id'
  | 'isOrphan'
  | 'isSelected'
  | 'isAlongsideSelected'
  | 'isExpanded'
  | 'children'
  | 'statuses'
  | 'isContextMenuOpen'
  | 'contextMenuEntryMethod'
  | 'openContextMenu'
  | 'closeContextMenu'
> {
  groupDualStatus?: Record<StoryId, { change: Status; test: Status }>;
  selectedStoryId: string | null;
  selectedParentId: string | null;
  expanded: Set<string>;
  contextMenuState: { itemId: string; entryMethod: 'pointer' | 'keyboard' } | null;
  openContextMenu: (itemId: string, entryMethod: 'pointer' | 'keyboard') => void;
  closeContextMenu: () => void;
}

function renderNode({
  expanded,
  groupDualStatus,
  selectedStoryId,
  selectedParentId,
  contextMenuState,
  openContextMenu,
  closeContextMenu,
  ...props
}: RenderNodeProps) {
  const renderNodeLevel = (item: TreeEntry) => {
    const itemStatuses = groupDualStatus?.[item.id];
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
        statuses={itemStatuses}
      >
        {item.resolvedChildren && (
          <Collection items={item.resolvedChildren}>
            {renderNode({
              ...props,
              expanded,
              groupDualStatus,
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
