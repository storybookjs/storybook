import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { Collection } from '@react-aria/collections';
import { Tree as AriaTree } from 'react-aria-components/patched-dist/Tree';
import type { API, IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getGroupStatus } from '../../utils/status.tsx';
import { type TreeEntry, collapseSingleStoryComponents, indexToTree } from '../../utils/tree.ts';
import { StatusContext } from './StatusContext.tsx';
import { TreeNode, type TreeNodeProps } from './TreeNode.tsx';
import { type ExpandAction, useExpanded } from './useExpanded.ts';

// TODO: When pressing enter on branch, expand/collapse it
// TODO: Find bug preventing branches from collapsing
// TODO: Restore the scrollIntoView for the currently selected story

const StyledAriaTree = styled(AriaTree)(({ theme }) => ({
  // TODO
}));
interface TreeProps {
  api: API;
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
  api,
  isDevelopment,
  allStatuses,
  refId,
  data,
  docsMode,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedItemRef = useRef<HTMLElement | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Rewrite the dataset to place the single child story in place of the component.
  const collapsedData = useMemo(() => collapseSingleStoryComponents(data), [data]);

  // Switch to a tree structure from now on.
  const tree = useMemo(() => indexToTree(collapsedData), [collapsedData]);

  // Track focused item with mutation observer TEMP/DEBUG/TODO
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      console.log('no container yet');
      return;
    }

    // Mutation observer to track focus changes
    const observer = new MutationObserver(() => {
      // Find the currently focused tree item
      const focusedElement = container.querySelector('[data-focused="true"]') as HTMLElement;
      if (focusedElement && focusedElement !== focusedItemRef.current) {
        focusedItemRef.current = focusedElement;
        setFocusedItemId(focusedElement.id);
        console.log('Focused item changed to:', focusedElement.id, focusedElement.textContent);
      }
    });

    observer.observe(container, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-focused'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // DEBUG/TODO use the tracked focused item
  useEffect(() => {
    if (focusedItemRef.current) {
      // console.log('UPDATE CURRENTLY FOCUSED', focusedItemRef.current);
      // const content = focusedItemRef.current.querySelector('[role="gridcell"]');
      // if (content) {
      //   const baseText = focusedItemRef.current.getAttribute('data-base-text');
      //   if (!baseText) {
      //     focusedItemRef.current.setAttribute('data-base-text', content.textContent || '');
      //   }
      //   const text = focusedItemRef.current.getAttribute('data-base-text') || '';
      //   content.textContent = text + ' (currently focused)';
      // }
    }
  }, [focusedItemId]);

  // // Track expanded nodes, keep it in sync with props and enable keyboard shortcuts.
  // TODO: try out other data format for performance.
  const [expanded, setExpanded] = useExpanded({
    refId,
    data: collapsedData,
    selectedStoryId,
  });

  // Compute group statuses and add them to individual entry statuses.
  const consolidatedStatuses = useMemo(() => {
    const groupStatus = getGroupStatus(collapsedData, allStatuses ?? {});
    return Object.assign({}, allStatuses, groupStatus);
  }, [allStatuses, collapsedData]);

  return (
    <StatusContext.Provider value={{ data: collapsedData, allStatuses }}>
      <div>
        <StyledAriaTree
          ref={containerRef}
          aria-label="Stories"
          selectionMode="single"
          expandedKeys={expanded}
          onExpandedChange={(keys) => setExpanded({ ids: Array.from(keys).map(String) })}
          selectedKeys={selectedStoryId ? new Set([selectedStoryId]) : new Set()}
          onSelectionChange={(keys) => {
            console.log('Selected', keys);
            const selectedKey = Array.from(keys)[0];
            if (selectedKey && typeof selectedKey === 'string') {
              onSelectStoryId(selectedKey);
            }
          }}
        >
          <Collection items={tree}>
            {renderNode({
              api,
              refId,
              docsMode,
              isDevelopment,
              consolidatedStatuses,
              data: collapsedData,
              onSelectStoryId,
              selectedStoryId,
              expanded,
              setExpanded,
            })}
          </Collection>
        </StyledAriaTree>
      </div>
    </StatusContext.Provider>
  );
});

interface RenderNodeProps extends Omit<
  TreeNodeProps,
  | 'item'
  | 'id'
  | 'isOrphan'
  | 'isSelected'
  | 'isExpanded'
  | 'setExpanded'
  | 'children'
  | 'statuses'
  | 'isContextMenuOpen'
> {
  consolidatedStatuses?: StatusesByStoryIdAndTypeId;
  selectedStoryId: string | null;
  expanded: string[];
  setExpanded: (action: ExpandAction) => void;
}

function renderNode({
  expanded,
  setExpanded,
  consolidatedStatuses,
  selectedStoryId,
  ...props
}: RenderNodeProps) {
  return function renderNodeLevel(item: TreeEntry) {
    return (
      <TreeNode
        {...props}
        key={item.id}
        item={item}
        // TODO review these conditions. What is isOrphan used for? Are roots orphans?
        isOrphan={item.depth === 0 && item.type !== 'root'}
        isExpanded={expanded.includes(item.id)}
        setExpanded={(expanded) => setExpanded({ ids: [item.id], append: true, value: expanded })}
        isSelected={selectedStoryId === item.id}
        statuses={consolidatedStatuses?.[item.id] ?? {}}
      >
        {item.resolvedChildren && (
          <Collection items={item.resolvedChildren}>
            {renderNode({ ...props, expanded, setExpanded, consolidatedStatuses, selectedStoryId })}
          </Collection>
        )}
      </TreeNode>
    );
  };
}
