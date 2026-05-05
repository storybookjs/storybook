import React, { useCallback, useMemo } from 'react';

import { Button } from 'storybook/internal/components';
import { PRELOAD_ENTRIES } from 'storybook/internal/core-events';
import type { StatusByTypeId, StatusValue } from 'storybook/internal/types';

import { ChevronSmallDownIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { internal_fullStatusStore as fullStatusStore } from '#manager-stores';
import { darken } from 'polished';
import { TreeItem, TreeItemContent } from 'react-aria-components/patched-dist/Tree';
import type { HashEntry } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
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

    /* Sticky section headers and spacers for root-level items */
    ...($level === 0 && {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      backgroundColor: theme.background.app,
      '&:not(:first-child)': {
        marginTop: 14,
      },
    }),

    /* Color handling — Figma: fgColor/default maps to theme.color.defaultText */
    color: $textColor ?? theme.color.defaultText,

    /* Hover — Figma: button/ghost/bgColor/hover → theme.background.hoverable,
     *         Figma: button/ghost/fgColor/hover → theme.barHoverColor */
    '&:hover, &[data-focused="true"]': {
      background: theme.background.hoverable,
      color: $textColor ?? theme.barHoverColor,
      outline: 'none',
      svg: { color: 'currentColor' },
    },

    /* Selected — Figma: button/accent/bgColor/rest → theme.color.secondary,
     *            Figma: neutral/white → theme.color.lightest,
     *            Figma: fontWeight/bold */
    '&[data-selected="true"]': {
      color: theme.color.lightest,
      background:
        theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
      fontWeight: theme.typography.weight.bold,

      '&&:hover, &&[data-focused="true"]': {
        color: theme.color.lightest,
        background:
          theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
      },
      svg: { color: theme.color.lightest },
    },

    /* Focus ring — Figma: Focus outline = box-shadow with fgColor/accent and bgColor/mute
     *   Rendered as: 0 0 0 2px bgColor/mute, 0 0 0 4px fgColor/accent
     *   Maps to: theme.background.app + theme.color.secondary */
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${theme.background.app}, 0 0 0 4px ${theme.color.secondary}`,
    },

    /* ContextMenu and StatusIcon visibility.
     * ContextMenu button is shown on hover/focus and when already open;
     * StatusIcon is hidden when ContextMenu button is visible. */
    '& [data-displayed="off"]': {
      visibility: 'hidden',
    },

    '&:hover [data-displayed="off"], &[data-focused="true"] [data-displayed="off"]': {
      visibility: 'visible',
    },

    '& [data-displayed="on"] + *': {
      visibility: 'hidden',
    },

    '&:hover [data-displayed="off"] + *, &[data-focused="true"] [data-displayed="off"] + *': {
      visibility: 'hidden',
    },

    '.hover-only': {
      display: 'none',
    },
    '&:hover .hover-only, &:focus-visible .hover-only, &[data-focused="true"] .hover-only': {
      display: 'flex',
      alignContent: 'center',
      alignItems: 'center',
    },
    '.static-only': {
      display: 'flex',
      alignContent: 'center',
      alignItems: 'center',
    },
    '&:hover .static-only, &:focus-visible .static-only, &[data-focused="true"] .static-only': {
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
  position: 'relative',
});

const Traces = styled.span<{ $depth: number }>(({ $depth }) => ({
  display: 'flex',
  gap: 0,
  alignItems: 'stretch',
  height: '100%',
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  pointerEvents: 'none',
}));

const TraceLine = styled.span<{ $offset: number }>(({ theme, $offset }) => ({
  position: 'absolute',
  left: `calc(${$offset} * 20px + 9px)`,
  top: 0,
  bottom: 0,
  width: 1,
  /* Figma: borderColor/default at rest → theme.appBorderColor.
   * On hover the tree container swaps these to blue/88 via a CSS variable. */
  backgroundColor: 'var(--tree-trace-color)',
  opacity: 0,
  transition: 'opacity 150ms ease',
}));

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

export type ContextMenuEntryMethod = 'pointer' | 'keyboard';

export interface TreeNodeProps {
  item: TreeEntry;
  refId: string;
  docsMode: boolean;
  isDevelopment: boolean;
  isOrphan: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onSelectStoryId: (itemId: string) => void;
  statuses: StatusByTypeId;
  api: API;
  data: Record<string, HashEntry>;
  /** Whether this item's context menu is currently open. */
  isContextMenuOpen?: boolean;
  /** How the context menu was opened — 'pointer' (click) or 'keyboard' (global shortcut). */
  contextMenuEntryMethod?: ContextMenuEntryMethod;
  /** Open the context menu for a given item ID with the specified entry method. */
  openContextMenu?: (itemId: string, entryMethod: ContextMenuEntryMethod) => void;
  /** Close the currently-open context menu. */
  closeContextMenu?: () => void;
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
  onSelectStoryId,
  statuses,
  api,
  data,
  isContextMenuOpen,
  contextMenuEntryMethod,
  openContextMenu,
  closeContextMenu,
  children,
}) {
  const theme = useTheme();
  const id = useMemo(() => createId(item.id, refId), [item.id, refId]);
  const { isDesktop, isMobile, setMobileMenuOpen } = useLayout();

  // Memoize renderContext so downstream useMemo deps don't bust every render.
  const renderContext = useMemo(
    () => ({ isMobile, location: 'sidebar' as const }),
    [isMobile]
  );

  // Per-item handler for toggling the context menu open/close, suitable as the `setIsOpen`
  // parameter for `useContextMenu`. Uses pointer mode by default when toggled via the ⋯ button.
  const handleContextMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openContextMenu?.(item.id, 'pointer');
      } else {
        closeContextMenu?.();
      }
    },
    [openContextMenu, closeContextMenu, item.id]
  );

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

  const contextMenu = useContextMenu(
    item,
    isContextMenuOpen ?? false,
    handleContextMenuOpenChange,
    statusLinks,
    api,
    data,
    contextMenuEntryMethod
  );

  const itemStatus = getMostCriticalStatusValue(Object.values(statuses || {}).map((s) => s.value));
  const { icon: statusIcon, textColor: statusTextColor } = getStatus(theme, itemStatus);

  const showBranchStatus = itemStatus === 'status-value:error' || itemStatus === 'status-value:warning';
  const isBranch = guardHasChildren(item);
  const hasContextMenu = guardHasContextMenu(contextMenu);

  const ariaLabel = useMemo(() => {
    let label = item.renderAriaLabel?.(item, api, renderContext) || item.name;

    if (itemStatus !== 'status-value:unknown' && (!isBranch || showBranchStatus)) {
      label += `. Test status: ${itemStatus.replace('status-value:', '')}`;
    }

    if (hasContextMenu) {
      const shortcut = shortcutToHumanString(api.getShortcutKeys().contextMenu);
      label += `. Press ${shortcut} for more actions`;
    }
    return label;
  }, [item, api, renderContext, hasContextMenu, itemStatus, isBranch, showBranchStatus]);



  const collapseAction = useMemo(() => {
    if (!isBranch) {
      return null;
    }

    return isExpanded ? <ChevronSmallDownIcon /> : <ChevronSmallRightIcon />;
  }, [isBranch, isExpanded]);

  const handleMouseEnter = useCallback(() => {
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
      onMouseEnter={handleMouseEnter}
    >
      <TreeItemContent>
        <StyledContent>
          {item.depth > 0 && (
            <Traces className="tree-traces" $depth={item.depth}>
              {Array.from({ length: item.depth }, (_, i) => (
                <TraceLine key={i} $offset={i} />
              ))}
            </Traces>
          )}
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

  return itemContent;
});
