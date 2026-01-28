import React, { useMemo, useRef } from 'react';

import { ListItem } from 'storybook/internal/components';
import type {
  API_HashEntry,
  API_IndexHash,
  API_IndexTree,
  API_TreeEntry,
  StatusesByStoryIdAndTypeId,
  StoryId,
} from 'storybook/internal/types';

import { TreeView } from '@primer/react';
import { useStorybookApi } from 'storybook/manager-api';
import type {
  API,
  ComponentEntry,
  GroupEntry,
  StoriesHash,
  StoryEntry,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getGroupStatus } from '../../utils/status.tsx';
import { getDescendantIds, isStoryHoistable } from '../../utils/tree.ts';
import { StatusContext } from './StatusContext.tsx';
import { TreeNode } from './TreeNode.tsx';
import type { ExpandAction, ExpandedState } from './useExpanded.ts';
import { useExpanded } from './useExpanded.ts';

export type ExcludesNull = <T>(x: T | null) => x is T;

export const ContextMenu = {
  ListItem,
};

const StyledTreeView = styled(TreeView)(({ theme }) => ({
  // TODO
}));

interface TreeProps {
  isBrowsing: boolean;
  isDevelopment: boolean;
  isMain: boolean;
  allStatuses?: StatusesByStoryIdAndTypeId;
  refId: string;
  data: StoriesHash;
  docsMode: boolean;
  // highlightedRef: MutableRefObject<Highlight>;
  // setHighlightedItemId: (itemId: string) => void;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}

const indexToTree = (index: API_IndexHash): API_IndexTree => {
  const tree: API_IndexTree = [];
  const children: Record<string, API_HashEntry[]> = {};
  const processingQueue: API_IndexTree = [];

  // First pass over index to identify every node's children, and add root nodes to tree
  for (const item of Object.values(index)) {
    if (item.type === 'root' || !item.parent) {
      tree.push({ ...item, resolvedChildren: [] });
    } else {
      children[item.parent] = children[item.parent] || [];
      children[item.parent].push(item);
    }
  }

  // Now browse through tree to add every node's children to it
  processingQueue.push(...tree);
  while (processingQueue.length > 0) {
    const current = processingQueue.shift()!;
    const currentChildren = children[current.id] || [];
    current.resolvedChildren = currentChildren;
    processingQueue.push(...currentChildren);
  }

  return tree;
};

export const Tree = React.memo<TreeProps>(function Tree({
  isBrowsing,
  isDevelopment,
  refId,
  data,
  allStatuses,
  docsMode,
  // highlightedRef,
  // setHighlightedItemId,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();
  const tree = useMemo(() => indexToTree(data), [data]);

  // Find top-level nodes and group them so we can hoist any orphans and expand any roots.
  const [rootIds, orphanIds, initialExpanded] = useMemo(
    () =>
      Object.keys(data).reduce<[string[], string[], ExpandedState]>(
        (acc, id) => {
          const item = data[id];

          if (item.type === 'root') {
            acc[0].push(id);
          } else if (!item.parent) {
            acc[1].push(id);
          }

          if (item.type === 'root' && item.startCollapsed) {
            acc[2][id] = false;
          }
          return acc;
        },
        [[], [], {}]
      ),
    [data]
  );

  // Create a map of expandable descendants for each root/orphan item, which is needed later.
  // Doing that here is a performance enhancement, as it avoids traversing the tree again later.
  const { expandableDescendants } = useMemo(() => {
    return [...orphanIds, ...rootIds].reduce(
      (acc, nodeId) => {
        // FIXME: this cant be correct as it ignores stories with children
        acc.expandableDescendants[nodeId] = getDescendantIds(data, nodeId, false).filter(
          (d) => !['story', 'docs'].includes(data[d].type)
        );
        return acc;
      },
      { expandableDescendants: {} as Record<string, string[]> }
    );
  }, [data, rootIds, orphanIds]);

  // Create a list of component IDs which should be collapsed into their (only) child.
  const singleStoryComponentIds = useMemo(() => {
    return Object.keys(data).filter((id) => {
      const entry = data[id];

      if (entry.type !== 'component') {
        return false;
      }

      const { children = [], name } = entry;

      if (children.length !== 1) {
        return false;
      }

      const onlyChild = data[children[0]];

      if (onlyChild.type === 'docs') {
        return true;
      }

      if (onlyChild.type === 'story' && onlyChild.subtype === 'story') {
        return isStoryHoistable(onlyChild.name, name);
      }
      return false;
    });
  }, [data]);

  // Omit single-story components from the list of nodes.
  const collapsedItems = useMemo(
    () => Object.keys(data).filter((id) => !singleStoryComponentIds.includes(id)),
    [data, singleStoryComponentIds]
  );

  // Rewrite the dataset to place the single child story in place of the component.
  const collapsedData = useMemo(() => {
    return singleStoryComponentIds.reduce(
      (acc, id) => {
        const { children, parent, name } = data[id] as ComponentEntry;
        const [childId] = children;
        if (parent) {
          const siblings = [...(data[parent] as GroupEntry).children];
          siblings[siblings.indexOf(id)] = childId;
          acc[parent] = { ...data[parent], children: siblings } as GroupEntry;
        }
        acc[childId] = {
          ...data[childId],
          name,
          parent,
          depth: data[childId].depth - 1,
        } as StoryEntry;
        return acc;
      },
      { ...data }
    );
  }, [data, singleStoryComponentIds]);

  // const ancestry = useMemo(() => {
  //   return collapsedItems.reduce(
  //     (acc, id) => Object.assign(acc, { [id]: getAncestorIds(collapsedData, id) }),
  //     {} as { [key: string]: string[] }
  //   );
  // }, [collapsedItems, collapsedData]);

  // // Track expanded nodes, keep it in sync with props and enable keyboard shortcuts.
  const [expanded, setExpanded] = useExpanded({
    // containerRef,
    // isBrowsing,
    refId,
    data: collapsedData,
    initialExpanded,
    rootIds,
    // TODO CONTINUE HERE STEVE: we want to replace the highlightedRef logic with a check
    // that the useExpanded tree is the one currently with focus. If it has focus, expand ancestry on init, else don't?
    // highlightedRef,
    // setHighlightedItemId,
    selectedStoryId,
    // onSelectStoryId,
  });

  const groupStatus = useMemo(
    () => getGroupStatus(collapsedData, allStatuses ?? {}),
    [collapsedData, allStatuses]
  );

  // const treeContent = useMemo(() => {
  //   const roots: React.ReactNode[] = [];
  //   const items: React.ReactNode[] = [];

  //   rootIds.forEach((itemId) => {
  //     const item = collapsedData[itemId];
  //     if (!item) {
  //       return;
  //     }

  //     if (item.type === 'root') {
  //       const descendants = expandableDescendants[item.id] || [];
  //       const isFullyExpanded = descendants.every((d: string) => expanded[d]);

  //       roots.push(
  //         <Root
  //           key={itemId}
  //           item={item}
  //           refId={refId}
  //           docsMode={docsMode}
  //           isDevelopment={isDevelopment}
  //           isSelected={selectedStoryId === itemId}
  //           isExpanded={!!expanded[itemId]}
  //           setExpanded={setExpanded}
  //           onSelectStoryId={onSelectStoryId}
  //           statuses={allStatuses?.[itemId] ?? {}}
  //           groupStatus={groupStatus}
  //           api={api}
  //           data={collapsedData}
  //           isFullyExpanded={isFullyExpanded}
  //           expandableDescendants={descendants}
  //         />
  //       );

  //       if (expanded[itemId] && 'children' in item && item.children) {
  //         item.children.forEach((childId) => {
  //           const childItem = collapsedData[childId];
  //           if (!childItem) {
  //             return;
  //           }

  //           const isDisplayed =
  //             !('parent' in childItem && childItem.parent) ||
  //             ancestry[childId].every((a: string) => expanded[a]);
  //           if (!isDisplayed) {
  //             return;
  //           }

  //           items.push(
  //             <TreeItem
  //               key={childId}
  //               item={childItem}
  //               refId={refId}
  //               docsMode={docsMode}
  //               isDevelopment={isDevelopment}
  //               isOrphan={false}
  //               isSelected={selectedStoryId === childId}
  //               isExpanded={!!expanded[childId]}
  //               setExpanded={setExpanded}
  //               onSelectStoryId={onSelectStoryId}
  //               statuses={allStatuses?.[childId] ?? {}}
  //               groupStatus={groupStatus}
  //               api={api}
  //               data={collapsedData}
  //             />
  //           );
  //         });
  //       }
  //     } else {
  //       // Orphan item
  //       const isDisplayed = !item.parent || ancestry[itemId].every((a: string) => expanded[a]);
  //       if (!isDisplayed) {
  //         return;
  //       }

  //       items.push(
  //         <TreeItem
  //           key={itemId}
  //           item={item}
  //           refId={refId}
  //           docsMode={docsMode}
  //           isDevelopment={isDevelopment}
  //           isOrphan={true}
  //           isSelected={selectedStoryId === itemId}
  //           isExpanded={!!expanded[itemId]}
  //           setExpanded={setExpanded}
  //           onSelectStoryId={onSelectStoryId}
  //           statuses={allStatuses?.[itemId] ?? {}}
  //           groupStatus={groupStatus}
  //           api={api}
  //           data={collapsedData}
  //         />
  //       );
  //     }
  //   });

  //   return { roots, items };
  // }, [
  //   effectiveRootIds,
  //   collapsedData,
  //   expandableDescendants,
  //   expanded,
  //   ancestry,
  //   refId,
  //   docsMode,
  //   isDevelopment,
  //   selectedStoryId,
  //   setExpanded,
  //   onSelectStoryId,
  //   allStatuses,
  //   groupStatus,
  //   api,
  // ]);

  return (
    <StatusContext.Provider value={{ data: collapsedData, allStatuses, groupStatus }}>
      {/* <div ref={containerRef}> */}
      {/* FIXME: this ref makes little sense. Why does useExpanded need it!? */}
      <StyledTreeView aria-label="TODO">
        {tree.map((item) => (
          <TreeNode
            key={item.id}
            item={item}
            refId={refId}
            docsMode={docsMode}
            isDevelopment={isDevelopment}
            isOrphan={true}
            isSelected={selectedStoryId === item.id}
            selectedStoryId={selectedStoryId}
            isExpanded={!!expanded[item.id]}
            setExpanded={setExpanded}
            onSelectStoryId={onSelectStoryId}
            statuses={allStatuses?.[item.id] ?? {}}
            groupStatus={groupStatus}
            api={api}
            data={data}
            // collapsedData={collapsedData}
            // isDisplayed={isDisplayed}
          />
        ))}
      </StyledTreeView>
      {/* </div> */}
    </StatusContext.Provider>
  );
});

// TODO: restore the scrollIntoView for the currently selected story if not done by Primer

// TODO: Expand the whole ancestry of the currently selected story whenever it changes.
// useEffect(() => {
//   setExpanded({ ids: getAncestorIds(data, selectedStoryId), value: true });
// }, [data, selectedStoryId]);

// TODO: see if any of the new code can be refactored with utils/tree stuff
