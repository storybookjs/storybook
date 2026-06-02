import type { MutableRefObject } from 'react';
import React, { useCallback, useMemo, useRef } from 'react';

import { Button, ListItem } from 'storybook/internal/components';
import { PRELOAD_ENTRIES } from 'storybook/internal/core-events';

import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  type API_HashEntry,
  type StatusByTypeId,
  type StatusesByStoryIdAndTypeId,
  type StatusValue,
  type StoryId,
} from 'storybook/internal/types';

import { CollapseIcon as CollapseIconSvg, ExpandAltIcon } from '@storybook/icons';

import { internal_fullStatusStore as fullStatusStore } from '#manager-stores';
import { darken } from 'polished';
import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import type {
  API,
  ComponentEntry,
  GroupEntry,
  StoriesHash,
  StoryEntry,
} from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';
import {
  getChangeDetectionStatus,
  getGroupDualStatus,
  getGroupStatus,
  getMostCriticalStatusValue,
  getStatus,
  statusPriority,
} from '../../utils/status.tsx';
import {
  createId,
  getAncestorIds,
  getDescendantIds,
  getLink,
  isStoryHoistable,
} from '../../utils/tree.ts';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { useContextMenu } from './ContextMenu.tsx';
import { StatusButton } from './StatusButton.tsx';
import { StatusContext } from './StatusContext.tsx';
import {
  ComponentNode,
  DocumentNode,
  GroupNode,
  RootNode,
  StoryBranchNode,
  StoryLeafNode,
  TestNode,
} from './TreeNode.tsx';
import { CollapseIcon } from './components/CollapseIcon.tsx';
import type { Highlight, Item } from './types.ts';
import type { ExpandAction, ExpandedState } from './useExpanded.ts';
import { useExpanded } from './useExpanded.ts';

export type ExcludesNull = <T>(x: T | null) => x is T;

const CollapseButton = styled(Button)(({ theme }) => ({
  fontSize: `${theme.typography.size.s1 - 1}px`,
  fontWeight: theme.typography.weight.bold,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: theme.textMutedColor,
  padding: '0 8px',
  flex: '1 1 auto',
  justifyContent: 'flex-start',
  '&:hover': {
    background: 'transparent',
  },
}));

export const LeafNodeStyleWrapper = styled.div(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  color: theme.color.defaultText,
  background: 'transparent',
  minHeight: 28,
  borderRadius: 4,
  overflow: 'hidden',
  '--tree-node-background-hover': theme.background.content,

  [MEDIA_DESKTOP_BREAKPOINT]: {
    '--tree-node-background-hover': theme.background.app,
  },

  '&:hover, &:focus': {
    '--tree-node-background-hover': theme.background.hoverable,
    background: 'var(--tree-node-background-hover)',
    outline: 'none',
  },

  '& [data-displayed="off"]': {
    visibility: 'hidden',
  },

  '&:hover [data-displayed="off"]': {
    visibility: 'visible',
  },

  '& [data-displayed="on"] + *': {
    visibility: 'hidden',
  },

  '&:hover [data-displayed="off"] + *': {
    visibility: 'hidden',
  },

  '&[data-selected="true"]': {
    color: theme.color.lightest,
    background: theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
    fontWeight: theme.typography.weight.bold,

    '&&:hover, &&:focus': {
      background:
        theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
    },
    svg: { color: theme.color.lightest },
  },

  a: { color: 'currentColor' },
}));

const SkipToContentLink = styled(Button)(({ theme }) => ({
  display: 'none',
  '@media (min-width: 600px)': {
    display: 'block',
    fontSize: '10px',
    overflow: 'hidden',
    width: 1,
    height: '20px',
    boxSizing: 'border-box',
    opacity: 0,
    padding: 0,

    '&:focus': {
      opacity: 1,
      padding: '5px 10px',
      background: 'white',
      color: theme.color.secondary,
      width: 'auto',
    },
  },
}));

const StatusSlots = styled.div({
  display: 'flex',
  alignItems: 'center',
});

export const ContextMenu = {
  ListItem,
};

const getStatusLabel = (status: StatusValue) =>
  status.split(':')[1].replace(/^./, (char) => char.toUpperCase());

interface NodeProps {
  item: Item;
  refId: string;
  docsMode: boolean;
  isOrphan: boolean;
  isDisplayed: boolean;
  isSelected: boolean;
  isFullyExpanded?: boolean;
  isExpanded: boolean;
  setExpanded: (action: ExpandAction) => void;
  setFullyExpanded?: () => void;
  onSelectStoryId: (itemId: string) => void;
  statuses: StatusByTypeId;
  groupDualStatus: Record<StoryId, { change: StatusValue; test: StatusValue }>;
  api: API;
  collapsedData: Record<string, API_HashEntry>;
  isModifiedFilterActive: boolean;
}

const Node = React.memo<NodeProps>(function Node(props) {
  const {
    item,
    statuses,
    groupDualStatus,
    refId,
    docsMode,
    isOrphan,
    isDisplayed,
    isSelected,
    isFullyExpanded,
    setFullyExpanded,
    isExpanded,
    setExpanded,
    onSelectStoryId,
    api,
    isModifiedFilterActive,
  } = props;
  const theme = useTheme();
  const { isDesktop, isMobile, setMobileMenuOpen } = useLayout();

  const statusLinks = useMemo<Link[]>(() => {
    if (item.type === 'root') {
      return [
        {
          id: isFullyExpanded ? 'collapse-all' : 'expand-all',
          title: isFullyExpanded ? 'Collapse all' : 'Expand all',
          icon: isFullyExpanded ? <CollapseIconSvg /> : <ExpandAltIcon />,
          onClick: () => {
            setFullyExpanded?.();
          },
        },
      ];
    }

    if (item.type === 'story' || item.type === 'docs') {
      return Object.entries(statuses)
        .filter(([, status]) => status.sidebarContextMenu !== false)
        .sort((a, b) => statusPriority.indexOf(a[1].value) - statusPriority.indexOf(b[1].value))
        .map(([typeId, status]) => ({
          id: typeId,
          title: status.title,
          description: status.description,
          'aria-label': `Test status for ${status.title}: ${status.value}`,
          icon: getStatus(theme, status.value).icon,
          onClick: () => {
            onSelectStoryId(item.id);
            fullStatusStore.selectStatuses([status]);
          },
        }));
    }

    return [];
  }, [item.id, item.type, isFullyExpanded, setFullyExpanded, onSelectStoryId, statuses, theme]);

  let contextMenu = useContextMenu(item, statusLinks, api);
  if (refId !== 'storybook_internal') {
    contextMenu = { node: null, onMouseEnter: () => {} };
  }

  const id = createId(item.id, refId);

  if (
    (item.type === 'story' &&
      !('children' in item && item.children) &&
      (!('subtype' in item) || item.subtype !== 'test')) ||
    item.type === 'docs'
  ) {
    const LeafNode = item.type === 'docs' ? DocumentNode : StoryLeafNode;

    const { changeStatus, testStatus } = getChangeDetectionStatus(statuses || {});
    const leafChangeIcon =
      changeStatus === 'status-value:unknown' ||
      changeStatus === 'status-value:affected' ||
      (changeStatus === 'status-value:modified' && !isModifiedFilterActive)
        ? null
        : getStatus(theme, changeStatus).icon;
    const { icon: testIcon } = getStatus(theme, testStatus);
    const overallStoryStatus = getMostCriticalStatusValue([changeStatus, testStatus]);
    const { textColor } = getStatus(theme, overallStoryStatus);

    return (
      <LeafNodeStyleWrapper
        key={id}
        className="sidebar-item"
        data-selected={isSelected}
        data-ref-id={refId}
        data-item-id={item.id}
        data-parent-id={item.parent}
        data-nodetype={item.type === 'docs' ? 'document' : 'story'}
        data-highlightable={isDisplayed}
        onMouseEnter={contextMenu.onMouseEnter}
      >
        <LeafNode
          // @ts-expect-error (non strict)
          style={isSelected ? {} : { color: textColor }}
          href={getLink(item, refId)}
          id={id}
          depth={isOrphan ? item.depth : item.depth - 1}
          onClick={(event) => {
            event.preventDefault();
            onSelectStoryId(item.id);

            if (isMobile) {
              setMobileMenuOpen(false);
            }
          }}
          {...(item.type === 'docs' && { docsMode })}
        >
          {(item.renderLabel as (i: typeof item, api: API) => React.ReactNode)?.(item, api) ||
            item.name}
        </LeafNode>
        {isSelected && (
          <SkipToContentLink asChild ariaLabel={false}>
            <a href="#storybook-preview-wrapper">Skip to content</a>
          </SkipToContentLink>
        )}
        {contextMenu.node}
        {leafChangeIcon && testIcon ? (
          <StatusSlots>
            <StatusButton
              ariaLabel={`Change status: ${getStatusLabel(changeStatus)}`}
              data-testid="tree-change-status-button"
              type="button"
              status={changeStatus}
              selectedItem={isSelected}
            >
              {leafChangeIcon}
            </StatusButton>
            <StatusButton
              ariaLabel={`Test status: ${getStatusLabel(testStatus)}`}
              data-testid="tree-status-button"
              type="button"
              status={testStatus}
              selectedItem={isSelected}
            >
              {testIcon}
            </StatusButton>
          </StatusSlots>
        ) : leafChangeIcon ? (
          <StatusButton
            ariaLabel={`Change status: ${getStatusLabel(changeStatus)}`}
            data-testid="tree-change-status-button"
            type="button"
            status={changeStatus}
            selectedItem={isSelected}
          >
            {leafChangeIcon}
          </StatusButton>
        ) : testIcon ? (
          <StatusButton
            ariaLabel={`Test status: ${getStatusLabel(testStatus)}`}
            data-testid="tree-status-button"
            type="button"
            status={testStatus}
            selectedItem={isSelected}
          >
            {testIcon}
          </StatusButton>
        ) : null}
      </LeafNodeStyleWrapper>
    );
  }

  if (item.type === 'root') {
    return (
      <RootNode
        key={id}
        id={id}
        className="sidebar-subheading"
        data-ref-id={refId}
        data-item-id={item.id}
        data-nodetype="root"
        onMouseEnter={contextMenu.onMouseEnter}
      >
        <CollapseButton
          variant="ghost"
          ariaLabel={isExpanded ? 'Collapse' : 'Expand'}
          data-action="collapse-root"
          onClick={(event) => {
            event.preventDefault();
            setExpanded({ ids: [item.id], value: !isExpanded });
          }}
          aria-expanded={isExpanded}
        >
          <CollapseIcon isExpanded={isExpanded} />
          {item.renderLabel?.(item, api) || item.name}
        </CollapseButton>
        {contextMenu.node}
      </RootNode>
    );
  }

  if (
    item.type === 'component' ||
    item.type === 'group' ||
    (item.type === 'story' && 'children' in item && item.children)
  ) {
    const { children = [] } = item;
    const BranchNode = { component: ComponentNode, group: GroupNode, story: StoryBranchNode }[
      item.type
    ];

    const { changeStatus: localChange, testStatus: localTest } = getChangeDetectionStatus(
      statuses || {}
    );
    const groupDual = groupDualStatus?.[item.id] || {
      change: 'status-value:unknown' as StatusValue,
      test: 'status-value:unknown' as StatusValue,
    };
    const branchChange = getMostCriticalStatusValue([localChange, groupDual.change]);
    const branchTest = getMostCriticalStatusValue([localTest, groupDual.test]);

    const shouldShowBranchChangeIcon =
      branchChange !== 'status-value:unknown' &&
      branchChange !== 'status-value:affected' &&
      (branchChange !== 'status-value:modified' || isModifiedFilterActive);
    const branchChangeIcon = shouldShowBranchChangeIcon
      ? getStatus(theme, branchChange).icon
      : null;
    const branchTestIcon = getStatus(theme, branchTest).icon;

    const overallStatus = getMostCriticalStatusValue([branchChange, branchTest]);
    const color = overallStatus ? getStatus(theme, overallStatus).textColor : null;

    return (
      <LeafNodeStyleWrapper
        key={id}
        className="sidebar-item"
        data-selected={isSelected}
        data-ref-id={refId}
        data-item-id={item.id}
        data-parent-id={item.parent}
        data-nodetype={item.type}
        data-highlightable={isDisplayed}
        onMouseEnter={contextMenu.onMouseEnter}
      >
        <BranchNode
          id={id}
          style={color && !isSelected ? { color } : {}}
          aria-controls={children.join(' ')}
          aria-expanded={isExpanded}
          depth={isOrphan ? item.depth : item.depth - 1}
          isExpandable={children.length > 0}
          isExpanded={isExpanded}
          onClick={(event) => {
            event.preventDefault();
            if (item.type === 'story') {
              onSelectStoryId(item.id);
              if (!isExpanded || isSelected) {
                setExpanded({ ids: [item.id], value: !isExpanded });
              }
            } else if (item.type === 'component') {
              if (!isExpanded && isDesktop) {
                onSelectStoryId(item.id);
              }
              setExpanded({ ids: [item.id], value: !isExpanded });
            } else {
              setExpanded({ ids: [item.id], value: !isExpanded });
            }
          }}
          onMouseEnter={() => {
            if (item.type === 'component' || item.type === 'story') {
              api.emit(PRELOAD_ENTRIES, {
                ids: [children[0]],
                options: { target: refId },
              });
            }
          }}
        >
          {(item.renderLabel as (i: typeof item, api: API) => React.ReactNode)?.(item, api) ||
            item.name}
        </BranchNode>
        {isSelected && (
          <SkipToContentLink asChild ariaLabel={false}>
            <a href="#storybook-preview-wrapper">Skip to content</a>
          </SkipToContentLink>
        )}
        {contextMenu.node}
        {branchChangeIcon && branchTestIcon ? (
          <StatusSlots>
            <StatusButton
              ariaLabel={`Change status: ${getStatusLabel(branchChange)}`}
              data-testid="tree-change-status-button"
              type="button"
              status={branchChange}
              selectedItem={isSelected}
            >
              {branchChangeIcon}
            </StatusButton>
            <StatusButton
              ariaLabel={`Test status: ${getStatusLabel(branchTest)}`}
              data-testid="tree-status-button"
              type="button"
              status={branchTest}
              selectedItem={isSelected}
            >
              {branchTestIcon}
            </StatusButton>
          </StatusSlots>
        ) : branchChangeIcon ? (
          <StatusButton
            ariaLabel={`Change status: ${getStatusLabel(branchChange)}`}
            data-testid="tree-change-status-button"
            type="button"
            status={branchChange}
            selectedItem={isSelected}
          >
            {branchChangeIcon}
          </StatusButton>
        ) : branchTestIcon ? (
          <StatusButton
            ariaLabel={`Test status: ${getStatusLabel(branchTest)}`}
            data-testid="tree-status-button"
            type="button"
            status={branchTest}
            selectedItem={isSelected}
          >
            {branchTestIcon}
          </StatusButton>
        ) : null}
      </LeafNodeStyleWrapper>
    );
  }

  const isTest = item.type === 'story' && item.subtype === 'test';
  const LeafNode = isTest ? TestNode : { docs: DocumentNode, story: StoryLeafNode }[item.type];
  const nodeType = isTest ? 'test' : { docs: 'document', story: 'story' }[item.type];

  // For leaf nodes, filter out change detection statuses (except "new")
  // because change detection statuses should appear at the branch/component level instead
  const leafStatuses = Object.fromEntries(
    Object.entries(statuses || {}).filter(
      ([, status]) =>
        status.typeId !== CHANGE_DETECTION_STATUS_TYPE_ID || status.value === 'status-value:new'
    )
  );
  const leafStatus = getMostCriticalStatusValue(Object.values(leafStatuses).map((s) => s.value));
  const { icon: leafIcon, textColor: leafColor } = getStatus(theme, leafStatus);
  const leafStatusButton = leafIcon ? (
    <StatusButton
      ariaLabel={`Status: ${getStatusLabel(leafStatus)}`}
      data-testid="tree-status-button"
      role="status"
      type="button"
      status={leafStatus}
      selectedItem={isSelected}
    >
      {leafIcon}
    </StatusButton>
  ) : null;

  return (
    <LeafNodeStyleWrapper
      key={id}
      className="sidebar-item"
      data-selected={isSelected}
      data-ref-id={refId}
      data-item-id={item.id}
      data-parent-id={item.parent}
      data-nodetype={nodeType}
      data-highlightable={isDisplayed}
      onMouseEnter={contextMenu.onMouseEnter}
    >
      <LeafNode
        style={leafColor && !isSelected ? { color: leafColor } : {}}
        href={getLink(item, refId)}
        id={id}
        depth={isOrphan ? item.depth : item.depth - 1}
        onClick={(event) => {
          event.preventDefault();
          onSelectStoryId(item.id);

          if (isMobile) {
            setMobileMenuOpen(false);
          }
        }}
      >
        {(item.renderLabel as (i: typeof item, api: API) => React.ReactNode)?.(item, api) ||
          item.name}
      </LeafNode>
      {isSelected && (
        <SkipToContentLink ariaLabel={false} asChild>
          <a href="#storybook-preview-wrapper">Skip to content</a>
        </SkipToContentLink>
      )}
      {contextMenu.node}
      {leafStatusButton}
    </LeafNodeStyleWrapper>
  );
});

const Root = React.memo<NodeProps & { expandableDescendants: string[] }>(function Root({
  setExpanded,
  isFullyExpanded,
  expandableDescendants,
  ...props
}) {
  const setFullyExpanded = useCallback(
    () => setExpanded({ ids: expandableDescendants, value: !isFullyExpanded }),
    [setExpanded, isFullyExpanded, expandableDescendants]
  );
  return (
    <Node
      {...props}
      setExpanded={setExpanded}
      isFullyExpanded={isFullyExpanded}
      setFullyExpanded={setFullyExpanded}
    />
  );
});

export const Tree = React.memo<{
  isBrowsing: boolean;
  isMain: boolean;
  allStatuses?: StatusesByStoryIdAndTypeId;
  refId: string;
  data: StoriesHash;
  docsMode: boolean;
  highlightedRef: MutableRefObject<Highlight>;
  setHighlightedItemId: (itemId: string) => void;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}>(function Tree({
  isBrowsing,
  refId,
  data,
  allStatuses,
  docsMode,
  highlightedRef,
  setHighlightedItemId,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();
  const includedStatusFilters = useStorybookState().includedStatusFilters ?? [];
  const isModifiedFilterActive = includedStatusFilters.includes('status-value:modified');

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
        acc.expandableDescendants[nodeId] = getDescendantIds(data, nodeId, false).filter(
          (d) => !['story', 'docs'].includes(data[d].type)
        );
        return acc;
      },
      { orphansFirst: [] as string[], expandableDescendants: {} as Record<string, string[]> }
    );
  }, [data, rootIds, orphanIds]);

  // Create a list of component IDs which should be collapsed into their (only) child.
  // That is:
  //  - components with a single story child with the same name
  //  - components with only a single docs child
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
  // TODO: Move this to the `transformStoryIndexToStoriesHash` util.
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

  const ancestry = useMemo(() => {
    return collapsedItems.reduce(
      (acc, id) => Object.assign(acc, { [id]: getAncestorIds(collapsedData, id) }),
      {} as { [key: string]: string[] }
    );
  }, [collapsedItems, collapsedData]);

  // Track expanded nodes, keep it in sync with props and enable keyboard shortcuts.
  const [expanded, setExpanded] = useExpanded({
    // @ts-expect-error (non strict)
    containerRef,
    isBrowsing,
    refId,
    data: collapsedData,
    initialExpanded,
    rootIds,
    highlightedRef,
    setHighlightedItemId,
    selectedStoryId,
    onSelectStoryId,
  });

  const groupStatus = useMemo(
    () => getGroupStatus(collapsedData, allStatuses ?? {}),
    [collapsedData, allStatuses]
  );

  const groupDualStatus = useMemo(
    () => getGroupDualStatus(collapsedData, allStatuses ?? {}),
    [collapsedData, allStatuses]
  );

  const treeItems = useMemo(() => {
    return collapsedItems.map((itemId) => {
      const item = collapsedData[itemId];
      const id = createId(itemId, refId);

      if (item.type === 'root') {
        const descendants = expandableDescendants[item.id];
        const isFullyExpanded = descendants.every((d: string) => expanded[d]);
        return (
          // @ts-expect-error (TODO)
          <Root
            api={api}
            key={id}
            item={item}
            refId={refId}
            collapsedData={collapsedData}
            isOrphan={false}
            isDisplayed
            isSelected={selectedStoryId === itemId}
            isExpanded={!!expanded[itemId]}
            setExpanded={setExpanded}
            isFullyExpanded={isFullyExpanded}
            expandableDescendants={descendants}
            onSelectStoryId={onSelectStoryId}
            isModifiedFilterActive={isModifiedFilterActive}
          />
        );
      }

      const isDisplayed = !item.parent || ancestry[itemId].every((a: string) => expanded[a]);

      if (isDisplayed === false) {
        return null;
      }

      return (
        <Node
          api={api}
          collapsedData={collapsedData}
          key={id}
          item={item}
          statuses={allStatuses?.[itemId] ?? {}}
          groupDualStatus={groupDualStatus}
          refId={refId}
          docsMode={docsMode}
          isOrphan={orphanIds.some((oid) => itemId === oid || itemId.startsWith(`${oid}-`))}
          isDisplayed={isDisplayed}
          isSelected={selectedStoryId === itemId}
          isExpanded={!!expanded[itemId]}
          setExpanded={setExpanded}
          onSelectStoryId={onSelectStoryId}
          isModifiedFilterActive={isModifiedFilterActive}
        />
      );
    });
  }, [
    ancestry,
    api,
    collapsedData,
    collapsedItems,
    docsMode,
    expandableDescendants,
    expanded,
    groupDualStatus,
    isModifiedFilterActive,
    onSelectStoryId,
    orphanIds,
    refId,
    selectedStoryId,
    setExpanded,
    allStatuses,
  ]);
  return (
    <StatusContext.Provider value={{ data, allStatuses, groupStatus }}>
      <div ref={containerRef}>{treeItems}</div>
    </StatusContext.Provider>
  );
});
