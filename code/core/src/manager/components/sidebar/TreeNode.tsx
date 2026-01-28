import React, { useCallback, useMemo, useRef, useState } from 'react';

import { Button, TooltipProvider } from 'storybook/internal/components';
import { PRELOAD_ENTRIES } from 'storybook/internal/core-events';
import type {
  API_HashEntry,
  API_TreeEntry,
  StatusByTypeId,
  StatusValue,
  StoryId,
} from 'storybook/internal/types';

import { TrashIcon } from '@storybook/icons';

import { internal_fullStatusStore as fullStatusStore } from '#manager-stores';
import { TreeView } from '@primer/react';
import type { API } from 'storybook/manager-api';
import { shortcutMatchesShortcut, shortcutToHumanString } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';
import { getGroupStatus, getMostCriticalStatusValue, getStatus } from '../../utils/status.tsx';
import {
  createId,
  getAncestorIds,
  getDescendantIds,
  getLink,
  isStoryHoistable,
} from '../../utils/tree.ts';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { useContextMenu } from './ContextMenu.tsx';
import { IconSymbols, UseSymbol } from './IconSymbols.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { StatusButton } from './StatusButton.tsx';
import { StatusContext } from './StatusContext.tsx';
import { CollapseIcon } from './components/CollapseIcon.tsx';
import { StatusIconMap } from './components/StatusIcon.tsx';
import type { Highlight, Item } from './types.ts';
import type { ExpandAction, ExpandedState } from './useExpanded.ts';
import { useExpanded } from './useExpanded.ts';

export const TypeIcon = styled.svg<{ type: 'component' | 'story' | 'test' | 'group' | 'docs' }>(
  ({ theme, type }) => ({
    width: 14,
    height: 14,
    flex: '0 0 auto',
    color: (() => {
      if (type === 'group') {
        return theme.base === 'dark' ? theme.color.primary : theme.color.ultraviolet;
      }

      if (type === 'component') {
        return theme.color.secondary;
      }

      if (type === 'docs') {
        return theme.base === 'dark' ? theme.color.gold : '#ff8300';
      }

      if (type === 'story') {
        return theme.color.seafoam;
      }

      if (type === 'test') {
        return theme.color.green;
      }

      return 'currentColor';
    })(),
  })
);

const StyledTreeItem = styled(TreeView.Item)(({ theme }) => ({
  '--tree-node-background-hover': 'var(--background-hover, var(--background-app))',
  [MEDIA_DESKTOP_BREAKPOINT]: {
    '--tree-node-background-hover': 'var(--background-app)',
  },

  // TODO find css class name
  '& .collapse-button': {
    fontSize: `${theme.typography.size.s1 - 1}px`,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: theme.textMutedColor,
    padding: '0 8px',
  },
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

export const TypeIconWithSymbol = React.memo<{
  type: 'component' | 'story' | 'test' | 'group' | 'docs';
}>(function TypeIconWithSymbol({ type }) {
  return (
    <TypeIcon viewBox="0 0 14 14" width="14" height="14" type={type}>
      <UseSymbol type={type} />
    </TypeIcon>
  );
});

const statusOrder: StatusValue[] = [
  'status-value:success',
  'status-value:error',
  'status-value:warning',
  'status-value:pending',
  'status-value:unknown',
];

// TODO use this?
const FloatingStatusButton = styled(StatusButton)({
  background: 'var(--tree-node-background-hover)',
  boxShadow: '0 0 5px 5px var(--tree-node-background-hover)',
  position: 'absolute',
  right: 0,
  zIndex: 1,
});

interface TreeNodeProps {
  item: API_TreeEntry;
  refId: string;
  docsMode: boolean;
  isDevelopment: boolean;
  isOrphan: boolean;
  selectedStoryId: string | null;
  isSelected: boolean;
  isExpanded: boolean;
  setExpanded: (action: ExpandAction) => void;
  onSelectStoryId: (itemId: string) => void;
  statuses: StatusByTypeId;
  groupStatus: Record<StoryId, StatusValue>;
  api: API;
  data: Record<string, API_HashEntry>;
}

function guardHasChildren(item: Item): item is Item & { children: string[] } {
  return 'children' in item && Array.isArray(item.children) && item.children.length > 0;
}

function guardHasContextMenu(
  contextMenu: {
    node: React.ReactNode;
    onMouseEnter: () => void;
  } | null
): contextMenu is { node: React.ReactNode; onMouseEnter: () => void } {
  return contextMenu?.node !== null;
}

export const TreeNode = React.memo<TreeNodeProps>(function TreeNode({
  item,
  refId,
  docsMode,
  isDevelopment,
  isOrphan,
  selectedStoryId,
  isSelected,
  isExpanded,
  setExpanded,
  onSelectStoryId,
  statuses,
  groupStatus,
  api,
  data,
}) {
  const theme = useTheme();
  const { isDesktop, isMobile, setMobileMenuOpen } = useLayout();
  const [contextMenuEntryMethod, setContextMenuEntryMethod] = useState<'mouse' | 'keyboard'>(
    'mouse'
  );

  const renderContext = { isMobile, location: 'sidebar' as const };

  const statusLinks = useMemo<Link[]>(() => {
    if (item.type === 'story' || item.type === 'docs') {
      return Object.entries(statuses)
        .filter(([, status]) => status.sidebarContextMenu !== false)
        .sort((a, b) => statusOrder.indexOf(a[1].value) - statusOrder.indexOf(b[1].value))
        .map(([typeId, status]) => ({
          id: typeId,
          title: status.title,
          description: status.description,
          'aria-label': `Test status for ${status.title}: ${status.value}`,
          icon: StatusIconMap[status.value],
          onClick: () => {
            onSelectStoryId(item.id);
            fullStatusStore.selectStatuses([status]);
          },
        }));
    }
    return [];
  }, [item.id, item.type, onSelectStoryId, statuses]);

  const id = createId(item.id, refId);

  // Should only have a context menu on non-composed storybooks? TODO: verify requirement with team
  const contextMenu = refId === DEFAULT_REF_ID ? useContextMenu(item, statusLinks, api) : null;

  const statusValue = getMostCriticalStatusValue(Object.values(statuses || {}).map((s) => s.value));
  const [statusIcon] = getStatus(theme, statusValue);

  const hasChildren = guardHasChildren(item);
  const hasContextMenu = guardHasContextMenu(contextMenu);

  const ariaLabel = useMemo(() => {
    let label = item.renderAriaLabel?.(item, api, renderContext) || item.name;
    if (hasContextMenu) {
      const shortcut = shortcutToHumanString(api.getShortcutKeys().contextMenu);
      label += `. Press ${shortcut} for more actions`;
    }
    return label;
  }, [item, api, renderContext, hasContextMenu]);

  const tooltipContent = useMemo(() => {
    if (hasContextMenu) {
      const shortcut = shortcutToHumanString(api.getShortcutKeys().contextMenu);
      return (
        <>
          Actions <kbd>{shortcut}</kbd>
        </>
      );
    }
    return null;
  }, [hasContextMenu, api]);

  // const handleKeyDown = useCallback(
  //   (event: React.KeyboardEvent) => {
  //     if (shortcutMatchesShortcut(event as any, api.getShortcutKeys().contextMenu)) {
  //       event.preventDefault();
  //       setContextMenuEntryMethod('keyboard');
  //       // The context menu will open via its own handlers
  //     }
  //   },
  //   [api]
  // );

  // const handleExpandedChange = useCallback(() => {
  //   setExpanded({ ids: [item.id], value: !isExpanded });
  // }, [item.id, isExpanded, setExpanded]);

  // TODO: on leaf selection within the tree
  // - onSelectStoryId(item.id);
  // - if isMobile setMobileMenuOpen(false)

  // TODO: on branch selection, we used to do onSelectStoryId(item.id);
  // - double check but we probably no longer want that

  // FIXME: is there a more general way to handle preloading based on current selection / active item? Maybe via a MutationObserver?
  // TODO: we also want to preload entries on focus
  // const handleFocus = useCallback(() => {
  //   // TODO/FIXME: discuss perf implications with N and Gert. We could either preload all children,
  //   // or only a select first few on the assumption they're more likely to be opened.
  //   // TODO: ask MS if we have telemetry data on which children get visited more often.
  //   if (hasChildren && (item.type === 'component' || item.type === 'story')) {
  //     api.emit(PRELOAD_ENTRIES, {
  //       ids: [item.children],
  //       options: { target: refId },
  //     });
  //   }
  // }, [hasChildren, item, api, refId]);

  const handleMouseEnter = useCallback(() => {
    // FIXME: logic flaw, what if we mouseEnter + press Enter on kb. We need different menus.
    setContextMenuEntryMethod('mouse');

    // TODO: check what this actually does
    contextMenu?.onMouseEnter();

    // FIXME: this logic was helpful for immediate loading of first story when expanding a comp
    // If we don't keep that logic (we decided we wouldn't with MA) then remove this
    if (item.type === 'component') {
      const children = 'children' in item ? item.children : [];
      if (children && children.length > 0) {
        api.emit(PRELOAD_ENTRIES, {
          ids: [children[0]],
          options: { target: refId },
        });
      }
    }
  }, [contextMenu, item, api, refId]);

  const itemContent = (
    <StyledTreeItem
      id={id}
      expanded={hasChildren ? isExpanded : undefined}
      onExpandedChange={
        hasChildren ? () => setExpanded({ ids: [item.id], value: !isExpanded }) : undefined
      }
      current={isSelected}
      // FIXME: we can't pass these events, must review the preloading strat
      // onFocus={handleFocus}
      // onMouseEnter={handleMouseEnter}
      // FIXME: make this a global kb shortcut and have it identify the currently highlighted item
      // onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      // data-selected={isSelected}
      // data-ref-id={refId}
      // data-item-id={item.id}
      // data-parent-id={(item as any).parent}
      // data-nodetype={
      //   item.type === 'story' && (item as any).subtype === 'test'
      //     ? ('test' as const)
      //     : item.type === 'docs'
      //       ? ('document' as const)
      //       : item.type === 'component'
      //         ? ('component' as const)
      //         : item.type === 'group'
      //           ? ('group' as const)
      //           : ('story' as const)
      // }
    >
      {item.type !== 'root' && (
        <TreeView.LeadingVisual>
          <TypeIconWithSymbol
            type={
              item.type === 'story' && 'subtype' in item && item.subtype === 'test'
                ? 'test'
                : item.type
            }
          />
        </TreeView.LeadingVisual>
      )}

      {item.renderLabel?.(item || [], api, renderContext) || item.name}

      {(statusIcon || hasContextMenu) && (
        <TreeView.TrailingVisual>
          {statusIcon && (
            <StatusButton
              ariaLabel={`Test status: ${statusValue.replace('status-value:', '')}`}
              data-testid="tree-status-button"
              type="button"
              status={statusValue}
              selectedItem={isSelected}
            >
              {statusIcon}
            </StatusButton>
          )}
          {hasContextMenu && contextMenu.node}
        </TreeView.TrailingVisual>
      )}

      {isSelected && (
        <SkipToContentLink asChild ariaLabel={false}>
          <a href="#storybook-preview-wrapper">Skip to content</a>
        </SkipToContentLink>
      )}

      {hasChildren && (
        <TreeView.SubTree>
          {item.resolvedChildren?.map((childItem) => {
            return (
              <TreeNode
                key={childItem.id}
                item={childItem}
                refId={refId}
                docsMode={docsMode}
                isDevelopment={isDevelopment}
                isOrphan={false}
                isSelected={selectedStoryId === childItem.id}
                selectedStoryId={selectedStoryId}
                isExpanded={isExpanded}
                setExpanded={setExpanded}
                onSelectStoryId={onSelectStoryId}
                statuses={statuses}
                groupStatus={groupStatus}
                api={api}
                data={data}
              />
            );
          })}
        </TreeView.SubTree>
      )}
    </StyledTreeItem>
  );

  // FIXME not working with the TreeView.Item component
  // TODO: use useTooltip lower level hook
  if (tooltipContent) {
    return (
      <TooltipProvider triggerOnFocusOnly={true} tooltip={tooltipContent}>
        {itemContent}
      </TooltipProvider>
    );
  }

  return itemContent;
});
