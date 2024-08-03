import { useStorybookApi } from '@storybook/core/manager-api';
import type {
  StoriesHash,
  GroupEntry,
  ComponentEntry,
  StoryEntry,
  State,
  API,
} from '@storybook/core/manager-api';
import { styled } from '@storybook/core/theming';
import { Button, IconButton, TooltipLinkList, WithTooltip } from '@storybook/core/components';
import { transparentize } from 'polished';
import type { MutableRefObject } from 'react';
import React, { useCallback, useMemo, useRef } from 'react';

import { PRELOAD_ENTRIES } from '@storybook/core/core-events';
import { ExpandAltIcon, CollapseIcon as CollapseIconSvg } from '@storybook/icons';
import { ComponentNode, DocumentNode, GroupNode, RootNode, StoryNode } from './TreeNode';

import type { ExpandAction, ExpandedState } from './useExpanded';

import { useExpanded } from './useExpanded';
import type { Highlight, Item } from './types';

import {
  isStoryHoistable,
  createId,
  getAncestorIds,
  getDescendantIds,
  getLink,
} from '../../utils/tree';
import { statusMapping, getHighestStatus, getGroupStatus } from '../../utils/status';
import { useLayout } from '../layout/LayoutProvider';
import { IconSymbols } from './IconSymbols';
import { CollapseIcon } from './components/CollapseIcon';

const Container = styled.div<{ hasOrphans: boolean }>((props) => ({
  marginTop: props.hasOrphans ? 20 : 0,
  marginBottom: 20,
}));

export const Action = styled.button<{ height?: number; width?: number }>(
  ({ theme, height, width }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: width || 20,
    height: height || 20,
    boxSizing: 'border-box',
    margin: 0,
    marginLeft: 'auto',
    padding: 0,
    outline: 0,
    lineHeight: 'normal',
    background: 'none',
    border: `1px solid transparent`,
    borderRadius: '100%',
    cursor: 'pointer',
    transition: 'all 150ms ease-out',
    color:
      theme.base === 'light'
        ? transparentize(0.3, theme.color.defaultText)
        : transparentize(0.6, theme.color.defaultText),

    '&:hover': {
      color: theme.color.secondary,
    },

    '&:focus': {
      color: theme.color.secondary,
      borderColor: theme.color.secondary,

      '&:not(:focus-visible)': {
        borderColor: 'transparent',
      },
    },

    svg: {
      width: 10,
      height: 10,
    },
  })
);

const CollapseButton = styled.button(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  padding: '0px 8px',
  borderRadius: 4,
  transition: 'color 150ms, box-shadow 150ms',
  gap: 6,
  alignItems: 'center',
  cursor: 'pointer',
  height: 28,

  '&:hover, &:focus': {
    outline: 'none',
    background: transparentize(0.93, theme.color.secondary),
  },
}));

export const LeafNodeStyleWrapper = styled.div(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingRight: 20,
  color: theme.color.defaultText,
  background: 'transparent',
  minHeight: 28,
  borderRadius: 4,

  '&:hover, &:focus': {
    outline: 'none',
    background: transparentize(0.93, theme.color.secondary),
  },

  '&[data-selected="true"]': {
    color: theme.color.lightest,
    background: theme.color.secondary,
    fontWeight: theme.typography.weight.bold,

    '&:hover, &:focus': {
      background: theme.color.secondary,
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

interface NodeProps {
  item: Item;
  refId: string;
  docsMode: boolean;
  isOrphan: boolean;
  isDisplayed: boolean;
  color: string | undefined;
  isSelected: boolean;
  isFullyExpanded?: boolean;
  isExpanded: boolean;
  setExpanded: (action: ExpandAction) => void;
  setFullyExpanded?: () => void;
  onSelectStoryId: (itemId: string) => void;
  status: State['status'][keyof State['status']];
  api: API;
}

const Node = React.memo<NodeProps>(function Node({
  item,
  status,
  refId,
  docsMode,
  isOrphan,
  isDisplayed,
  isSelected,
  isFullyExpanded,
  color,
  setFullyExpanded,
  isExpanded,
  setExpanded,
  onSelectStoryId,
  api,
}) {
  const { isDesktop, isMobile, setMobileMenuOpen } = useLayout();

  if (!isDisplayed) {
    return null;
  }

  const id = createId(item.id, refId);
  if (item.type === 'story' || item.type === 'docs') {
    const LeafNode = item.type === 'docs' ? DocumentNode : StoryNode;

    const statusValue = getHighestStatus(Object.values(status || {}).map((s) => s.status));
    const [icon, textColor] = statusMapping[statusValue];

    return (
      <LeafNodeStyleWrapper
        data-selected={isSelected}
        data-ref-id={refId}
        data-item-id={item.id}
        data-parent-id={item.parent}
        data-nodetype={item.type === 'docs' ? 'document' : 'story'}
        data-highlightable={isDisplayed}
        className="sidebar-item"
      >
        <LeafNode
          // @ts-expect-error (non strict)
          style={isSelected ? {} : { color: textColor }}
          key={id}
          href={getLink(item, refId)}
          id={id}
          depth={isOrphan ? item.depth : item.depth - 1}
          onClick={(event) => {
            event.preventDefault();
            onSelectStoryId(item.id);
            if (isMobile) setMobileMenuOpen(false);
          }}
          {...(item.type === 'docs' && { docsMode })}
        >
          {(item.renderLabel as (i: typeof item, api: API) => React.ReactNode)?.(item, api) ||
            item.name}
        </LeafNode>
        {isSelected && (
          <SkipToContentLink asChild>
            <a href="#storybook-preview-wrapper">Skip to canvas</a>
          </SkipToContentLink>
        )}
        {icon ? (
          <WithTooltip
            placement="top"
            style={{ display: 'flex' }}
            tooltip={() => (
              <TooltipLinkList
                links={Object.entries(status || {}).map(([k, v]) => ({
                  id: k,
                  title: v.title,
                  description: v.description,
                  right: statusMapping[v.status][0],
                }))}
              />
            )}
            closeOnOutsideClick
          >
            <Action type="button" height={22}>
              {icon}
            </Action>
          </WithTooltip>
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
      >
        <CollapseButton
          type="button"
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
        {isExpanded && (
          <IconButton
            className="sidebar-subheading-action"
            aria-label={isFullyExpanded ? 'Expand' : 'Collapse'}
            data-action="expand-all"
            data-expanded={isFullyExpanded}
            onClick={(event) => {
              event.preventDefault();
              // @ts-expect-error (non strict)
              setFullyExpanded();
            }}
          >
            {isFullyExpanded ? <CollapseIconSvg /> : <ExpandAltIcon />}
          </IconButton>
        )}
      </RootNode>
    );
  }

  if (item.type === 'component' || item.type === 'group') {
    const BranchNode = item.type === 'component' ? ComponentNode : GroupNode;
    return (
      <BranchNode
        key={id}
        id={id}
        style={color ? { color } : {}}
        className="sidebar-item"
        data-ref-id={refId}
        data-item-id={item.id}
        data-parent-id={item.parent}
        data-nodetype={item.type === 'component' ? 'component' : 'group'}
        data-highlightable={isDisplayed}
        aria-controls={item.children && item.children[0]}
        aria-expanded={isExpanded}
        depth={isOrphan ? item.depth : item.depth - 1}
        isComponent={item.type === 'component'}
        isExpandable={item.children && item.children.length > 0}
        isExpanded={isExpanded}
        onClick={(event) => {
          event.preventDefault();
          setExpanded({ ids: [item.id], value: !isExpanded });
          if (item.type === 'component' && !isExpanded && isDesktop) onSelectStoryId(item.id);
        }}
        onMouseEnter={() => {
          if (item.type === 'component') {
            api.emit(PRELOAD_ENTRIES, {
              ids: [item.children[0]],
              options: { target: refId },
            });
          }
        }}
      >
        {(item.renderLabel as (i: typeof item, api: API) => React.ReactNode)?.(item, api) ||
          item.name}
      </BranchNode>
    );
  }

  return null;
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
  status?: State['status'];
  refId: string;
  data: StoriesHash;
  docsMode: boolean;
  highlightedRef: MutableRefObject<Highlight>;
  setHighlightedItemId: (itemId: string) => void;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}>(function Tree({
  isBrowsing,
  isMain,
  refId,
  data,
  status,
  docsMode,
  highlightedRef,
  setHighlightedItemId,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();

  // Find top-level nodes and group them so we can hoist any orphans and expand any roots.
  const [rootIds, orphanIds, initialExpanded] = useMemo(
    () =>
      Object.keys(data).reduce<[string[], string[], ExpandedState]>(
        (acc, id) => {
          const item = data[id];
          if (item.type === 'root') acc[0].push(id);
          else if (!item.parent) acc[1].push(id);
          if (item.type === 'root' && item.startCollapsed) acc[2][id] = false;
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
      if (entry.type !== 'component') return false;

      const { children = [], name } = entry;
      if (children.length !== 1) return false;

      const onlyChild = data[children[0]];

      if (onlyChild.type === 'docs') return true;
      if (onlyChild.type === 'story') return isStoryHoistable(onlyChild.name, name);
      return false;
    });
  }, [data]);

  // Omit single-story components from the list of nodes.
  const collapsedItems = useMemo(
    () => Object.keys(data).filter((id) => !singleStoryComponentIds.includes(id)),
    [singleStoryComponentIds]
  );

  // Rewrite the dataset to place the child story in place of the component.
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
  }, [data]);

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

  // @ts-expect-error (non strict)
  const groupStatus = useMemo(() => getGroupStatus(collapsedData, status), [collapsedData, status]);

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
            key={id}
            item={item}
            refId={refId}
            isOrphan={false}
            isDisplayed
            isSelected={selectedStoryId === itemId}
            isExpanded={!!expanded[itemId]}
            setExpanded={setExpanded}
            isFullyExpanded={isFullyExpanded}
            expandableDescendants={descendants}
            onSelectStoryId={onSelectStoryId}
          />
        );
      }

      const isDisplayed = !item.parent || ancestry[itemId].every((a: string) => expanded[a]);
      const color = groupStatus[itemId] ? statusMapping[groupStatus[itemId]][1] : null;

      return (
        <Node
          api={api}
          key={id}
          item={item}
          // @ts-expect-error (non strict)

          status={status?.[itemId]}
          refId={refId}
          // @ts-expect-error (non strict)
          color={color}
          docsMode={docsMode}
          isOrphan={orphanIds.some((oid) => itemId === oid || itemId.startsWith(`${oid}-`))}
          isDisplayed={isDisplayed}
          isSelected={selectedStoryId === itemId}
          isExpanded={!!expanded[itemId]}
          setExpanded={setExpanded}
          onSelectStoryId={onSelectStoryId}
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
    groupStatus,
    onSelectStoryId,
    orphanIds,
    refId,
    selectedStoryId,
    setExpanded,
    status,
  ]);
  return (
    <Container ref={containerRef} hasOrphans={isMain && orphanIds.length > 0}>
      <IconSymbols />
      {treeItems}
    </Container>
  );
});
