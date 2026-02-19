import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, TooltipProvider } from 'storybook/internal/components';
import { PRELOAD_ENTRIES, SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';
import type { StatusByTypeId, StatusValue } from 'storybook/internal/types';

import { ChevronSmallDownIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { internal_fullStatusStore as fullStatusStore } from '#manager-stores';
import { darken } from 'polished';
import { TreeItem, TreeItemContent } from 'react-aria-components/patched-dist/Tree';
import type { HashEntry } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { shortcutMatchesShortcut, shortcutToHumanString } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';
import { getMostCriticalStatusValue, getStatus } from '../../utils/status.tsx';
import {
  type TreeEntry,
  createId,
  getAncestorIds,
  getDescendantIds,
  getLink,
} from '../../utils/tree.ts';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { useContextMenu } from './ContextMenu.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { StatusIconContainer } from './StatusButton.tsx';
import { StatusIconMap } from './components/StatusIcon.tsx';
import { TypeIconWithSymbol } from './components/TypeIcon.tsx';
import type { Item } from './types.ts';

const StyledTreeItem = styled(TreeItem)<{ $level: number; $textColor: string | null }>(
  ({ $level, theme, $textColor }) => ({
    /* Indent based on tree level */
    paddingInlineStart: `calc(${$level} * 20px)`,

    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: 'transparent',
    minHeight: 28,
    borderRadius: 4,
    overflow: 'hidden',
    a: { color: $textColor ?? 'currentColor' },

    /* Color handling. */
    color: $textColor ?? theme.color.defaultText,
    '--tree-node-background-hover': theme.background.content,
    [MEDIA_DESKTOP_BREAKPOINT]: {
      '--tree-node-background-hover': theme.background.app,
    },

    '&:hover, &:focus': {
      '--tree-node-background-hover': theme.background.hoverable,
      background: 'var(--tree-node-background-hover)',
      outline: 'none',
    },

    '&[data-selected="true"]': {
      color: theme.color.lightest,
      background:
        theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
      fontWeight: theme.typography.weight.bold,

      '&&:hover, &&:focus': {
        background:
          theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
      },
      svg: { color: theme.color.lightest },
    },

    '&:focus-visible': {
      outline: `2px solid ${theme.color.secondary}`,
      outlineOffset: 2,
    },

    /* ContextMenu and StatusIcon visibility.
     * ContextMenu is shown on hover/focus and when already open,
     * StatusIcon is hidden when ContextMenu is visible. */
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

    '.hover-only': {
      display: 'none',
    },
    '&:hover .hover-only, &:focus-visible .hover-only': {
      display: 'flex',
      alignContent: 'center',
      alignItems: 'center',
    },
    '.static-only': {
      display: 'flex',
      alignContent: 'center',
      alignItems: 'center',
    },
    '&:hover .static-only, &:focus-visible .static-only': {
      display: 'none',
    },
  })
);

const StyledContent = styled.div({
  // NOTE: we don't use gap because of the invisible SkipLink
  display: 'flex',
  minWidth: 28,
  minHeight: 28,
  padding: 2,
  paddingInlineStart: 7,
  justifyContent: 'center',
  alignItems: 'center',
  flex: '1 0 0',
});

const StyledLabel = styled.span({
  flex: '1 1 auto',
  marginInlineStart: 6,
});

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

const statusOrder: StatusValue[] = [
  'status-value:success',
  'status-value:error',
  'status-value:warning',
  'status-value:pending',
  'status-value:unknown',
];

export interface TreeNodeProps {
  item: TreeEntry;
  refId: string;
  docsMode: boolean;
  isDevelopment: boolean;
  isOrphan: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
  onSelectStoryId: (itemId: string) => void;
  statuses: StatusByTypeId;
  api: API;
  data: Record<string, HashEntry>;
  children?: React.ReactNode;
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
  isSelected,
  isExpanded,
  setExpanded,
  onSelectStoryId,
  statuses,
  api,
  data,
  children,
}) {
  const theme = useTheme();
  const id = useMemo(() => createId(refId, item.id), [refId, item.id]);
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
            onSelectStoryId(id);
            fullStatusStore.selectStatuses([status]);
          },
        }));
    }
    return [];
  }, [id, item.type, onSelectStoryId, statuses]);

  // Should only have a context menu on non-composed storybooks? TODO: verify requirement with team
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  useEffect(() => {
    if (!api || !isSelected) {
      return;
    }

    const openContextMenu = () => setContextMenuOpen(true);

    api.on(SIDEBAR_OPEN_CONTEXT_MENU, openContextMenu);

    return () => {
      api.off(SIDEBAR_OPEN_CONTEXT_MENU, openContextMenu);
    };
  }, [api, isSelected]);

  const contextMenu =
    refId === DEFAULT_REF_ID
      ? useContextMenu(item, contextMenuOpen, setContextMenuOpen, statusLinks, api)
      : null;

  const itemStatus = getMostCriticalStatusValue(Object.values(statuses || {}).map((s) => s.value));
  const [statusIcon, statusTextColor] = getStatus(theme, itemStatus);

  const showBranchStatus = itemStatus === 'status-value:error' || status === 'status-value:warning';
  const isBranch = guardHasChildren(item);
  const hasContextMenu = guardHasContextMenu(contextMenu);

  const ariaLabel = useMemo(() => {
    let label = item.renderAriaLabel?.(item, api, renderContext) || item.name;

    if (itemStatus !== 'status-value:unknown' && (!isBranch || showBranchStatus)) {
      label += `. Test status: ${itemStatus.replace('status-value:', '')}`;
    }

    if (hasContextMenu) {
      console.log(api.getShortcutKeys());
      const shortcut = shortcutToHumanString(api.getShortcutKeys().contextMenu);
      label += `. Press ${shortcut} for more actions`;
    }
    return label;
  }, [item, api, renderContext, hasContextMenu, itemStatus, isBranch, showBranchStatus]);

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

  const collapseAction = useMemo(() => {
    if (!isBranch) {
      return null;
    }

    return isExpanded ? <ChevronSmallDownIcon /> : <ChevronSmallRightIcon />;
  }, [isBranch, isExpanded]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      console.log('event', event);
      if (shortcutMatchesShortcut([event.key], api.getShortcutKeys().contextMenu)) {
        event.preventDefault();
        console.log('TODO: open context menu on kb');
      }
    },
    [api]
  );

  // TODO: either do it here with ExpandAction or in Tree renderNode.
  // const handleExpandedChange = useCallback(() => {
  //   setExpanded({ ids: [item.id], append: true, value: !isExpanded });
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

  const finalType = useMemo(
    () =>
      item.type === 'story' && 'subtype' in item && item.subtype === 'test' ? 'test' : item.type,

    [item.type]
  );

  const itemContent = (
    <StyledTreeItem
      $level={item.depth}
      $textColor={statusTextColor}
      textValue={item.name}
      aria-label={ariaLabel}
      id={id}
      data-item-id={item.id}
      data-ref-id={refId}
      // FIXME: we can't pass these events, must review the preloading strat
      // onFocus={handleFocus}
      // onMouseEnter={handleMouseEnter}
      // FIXME: make this a global kb shortcut and have it identify the currently highlighted item
      // onKeyDown={handleKeyDown}
      // data-ref-id={refId}
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
      <TreeItemContent>
        <StyledContent>
          {finalType === 'root' ? (
            collapseAction
          ) : (
            <>
              <span className="hover-only">{collapseAction}</span>
              <span className={isBranch ? 'static-only' : undefined}>
                <TypeIconWithSymbol type={finalType} />
              </span>
            </>
          )}

          <StyledLabel>
            {item.renderLabel?.(item || [], api, renderContext) || item.name}
          </StyledLabel>

          {hasContextMenu && <span className="hover-only">{contextMenu.node}</span>}
          {statusIcon && (!isBranch || showBranchStatus) && (
            <span className="static-only">
              <StatusIconContainer
                data-testid="tree-status-button"
                status={itemStatus}
                selectedItem={isSelected}
              >
                {statusIcon}
              </StatusIconContainer>
            </span>
          )}

          {isSelected && (
            <SkipToContentLink asChild ariaLabel={false}>
              <a href="#storybook-preview-wrapper">Skip to content</a>
            </SkipToContentLink>
          )}
        </StyledContent>
      </TreeItemContent>
      {children}
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
