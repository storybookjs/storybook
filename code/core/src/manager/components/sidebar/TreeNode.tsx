import React, { useCallback, useMemo } from 'react';

import { Button } from 'storybook/internal/components';
import type { Status, StatusValue } from 'storybook/internal/types';

import { ChevronSmallDownIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { internal_fullStatusStore as fullStatusStore } from '#manager-stores';
import { darken, transparentize } from 'polished';
import { TreeItem, TreeItemContent } from 'react-aria-components/patched-dist/Tree';
import type { HashEntry } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { getMostCriticalStatusValue, getStatus } from '../../utils/status.tsx';
import { type TreeEntry, createId } from '../../utils/tree.ts';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { useContextMenu } from './ContextMenu.tsx';

import { StatusIconContainer } from './StatusButton.tsx';
import { StatusIconMap } from './components/StatusIcon.tsx';
import { TypeIconWithSymbol } from './components/TypeIcon.tsx';
import type { Item } from './types.ts';

const StyledTreeItem = styled(TreeItem)<{
  $level: number;
  $textColor: string | null;
}>(({ $level, theme, $textColor }) => ({
  // General layout.
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: 'transparent',
  minHeight: 28,
  borderRadius: 4,
  overflow: 'hidden',

  // Indent based on tree level.
  paddingInlineStart: `calc(${$level} * 20px)`,

  // FIXME: This cannot be the right implem. We don't want lvl0 to stick all in the same spot,
  // we want the entire chain of currentlySelected parents to stick nicely without overlapping.
  /* Sticky section headers and spacers for root-level items */
  // ...($level === 0 && {
  //   position: 'sticky',
  //   top: 0,
  //   zIndex: 1,
  //   backgroundColor: theme.background.app,
  //   '&:not(:first-child)': {
  //     marginTop: 14,
  //   },
  // }),

  // Base colors.
  color: $textColor ?? theme.color.defaultText,
  '--trace-color': theme.appBorderColor,
  a: { color: $textColor ?? 'currentColor' },

  // Hover colors: data-focused is set by RAC on hovered items (it mixes hover/focus states).
  '&:hover, &[data-focused="true"]': {
    background: theme.background.hoverable,
    color: $textColor ?? theme.barHoverColor,
    outline: 'none',
    '--trace-color': transparentize(0.52, theme.color.secondary),
    svg: { color: 'currentColor' },
  },

  // Selected colors.
  '&[data-selected="true"]': {
    color: theme.color.lightest,
    background: theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
    fontWeight: theme.typography.weight.bold,
    svg: { color: theme.color.lightest },
  },

  // Focus colors.
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.background.app}, 0 0 0 4px ${theme.color.secondary}`,
    '--trace-color': transparentize(0.88, theme.color.secondary),
  },

  /* ContextMenu, StatusIcon, chevron and TypeIcon visibility.
   * ContextMenu button is shown on hover/focus and when already open;
   * Expand/collapse chevron is shown instead of the TypeIcon on hover/focus;
   * StatusIcon is hidden when ContextMenu button is visible. */

  // TODO/FIXME: replace all this with a data-menu-open attr or with aria-expanded on the button.

  // '& [data-displayed="off"]': {
  //   visibility: 'hidden',
  // },

  // '&:hover [data-displayed="off"], &[data-focused="true"] [data-displayed="off"]': {
  //   visibility: 'visible',
  // },

  // '& [data-displayed="on"] + *': {
  //   visibility: 'hidden',
  // },

  // '&:hover [data-displayed="off"] + *, &[data-focused="true"] [data-displayed="off"] + *': {
  //   visibility: 'hidden',
  // },

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
}));

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

const StyledTraces = styled.span({
  display: 'flex',
  gap: 0,
  alignItems: 'stretch',
  height: '100%',
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  pointerEvents: 'none',
});

const StyledTraceLine = styled.span<{ $offset: number; $forceVisible?: boolean }>(
  ({ $offset, $forceVisible }) => ({
    position: 'absolute',
    left: `calc(${$offset} * -20px - 7px)`,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'var(--trace-color)',
    opacity: $forceVisible ? 1 : 'var(--trace-opacity, 0)',
    transition: 'opacity 150ms ease',
  })
);

const Traces = ({
  level,
  isAlongsideSelected,
}: {
  level: number;
  isAlongsideSelected: boolean;
}) => {
  if (level === 0) {
    return null;
  }

  return (
    <StyledTraces>
      {Array.from({ length: level }, (_, i) => (
        <StyledTraceLine key={i} $offset={i} $forceVisible={isAlongsideSelected && i === 0} />
      ))}
    </StyledTraces>
  );
};

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

export type ContextMenuEntryMethod = 'pointer' | 'keyboard';

export interface TreeNodeProps {
  item: TreeEntry;
  refId: string;
  docsMode: boolean;
  isDevelopment: boolean;
  isOrphan: boolean;
  isSelected: boolean;
  isAlongsideSelected: boolean;
  isExpanded: boolean;
  onSelectStoryId: (itemId: string) => void;
  statuses?: { change: Status; test: Status };
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
  } | null
): contextMenu is { node: React.ReactNode } {
  return contextMenu?.node !== null;
}

const StatusLabelsInContextMenu: Record<StatusValue, string> = {
  'status-value:success': 'Passing',
  'status-value:error': 'Has errors',
  'status-value:warning': 'Has warnings',
  'status-value:pending': 'Status pending',
  'status-value:unknown': 'Status unknown',
  'status-value:new': 'New',
  'status-value:modified': 'Modified',
  'status-value:affected': 'Related', // TODO/FIXME: talk to MA about using better copy here.
};

const StatusLabelsInAriaLabel: Record<StatusValue, string> = {
  'status-value:success': 'Tests passing',
  'status-value:error': 'Tests failing',
  'status-value:warning': 'Tests passing with warnings',
  'status-value:pending': 'Test status pending',
  'status-value:unknown': 'Test status unknown',
  'status-value:new': 'Has new stories',
  'status-value:modified': 'Has modified stories',
  'status-value:affected': 'Affected by other changes', // TODO/FIXME: talk to MA about using better copy here.
};

export const TreeNode = React.memo<TreeNodeProps>(function TreeNode({
  item,
  refId,
  isSelected,
  isAlongsideSelected,
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

  const { isMobile } = useLayout();
  const location = isMobile ? 'bottom-bar' : 'sidebar';

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

  // TODO next
  // Add isModifiedFilterActive: boolean and groupDualStatus: Record<string, { change: StatusValue; test: StatusValue }> to TreeNodeProps
  // Split the current single-icon status rendering into dual change+test icons — for branches use getChangeDetectionStatus(statuses) + groupDualStatus[item.id] and pick the most critical of each; for leaves filter out change detection statuses (except new)
  // Handle the isModifiedFilterActive suppression of the change icon

  // Compute status items to go in the ContextMenu.
  const statusLinks = useMemo<Link[]>(() => {
    if (item.type !== 'story' && item.type !== 'docs') {
      return [];
    }
    return Object.entries(statuses || {})
      .filter(([, status]) => status.sidebarContextMenu !== false)
      .map(([typeId, status]) => ({
        id: typeId,
        title: status.title,
        description: status.description,
        'aria-label': `${status.title}: ${StatusLabelsInContextMenu[status.value]}.`,
        icon: StatusIconMap[status.value],
        onClick: () => {
          onSelectStoryId(id);
          fullStatusStore.selectStatuses([status]);
        },
      }));
  }, [id, item.type, onSelectStoryId, statuses]);

  const contextMenu = useContextMenu(
    item,
    // FIXME/TODO: why is there a mixed state model here?
    isContextMenuOpen ?? false,
    handleContextMenuOpenChange,
    statusLinks,
    api,
    data,
    contextMenuEntryMethod
  );

  const itemStatus = getMostCriticalStatusValue(Object.values(statuses || {}).map((s) => s.value));
  const { icon: statusIcon, textColor: statusTextColor } = getStatus(theme, itemStatus);

  const showBranchStatus =
    itemStatus === 'status-value:error' || itemStatus === 'status-value:warning';
  const isBranch = guardHasChildren(item);
  const hasContextMenu = guardHasContextMenu(contextMenu);

  // Compute final aria-label including test status and keyboard shortcut discovery.
  const ariaLabel = useMemo(() => {
    let label = item.renderAriaLabel?.(item, api, { location }) || item.name;

    if (itemStatus !== 'status-value:unknown' && (!isBranch || showBranchStatus)) {
      label += `. ${StatusLabelsInAriaLabel[itemStatus]}`;
    }

    if (hasContextMenu) {
      const shortcut = shortcutToHumanString(api.getShortcutKeys().contextMenu);
      label += `. Press ${shortcut} for more actions`;
    }
    return label;
  }, [item, api, location, hasContextMenu, itemStatus, isBranch, showBranchStatus]);

  const prefixAction = useMemo(() => {
    if (item.type === 'root') {
      return isExpanded ? <ChevronSmallDownIcon /> : <ChevronSmallRightIcon />;
    }

    if (isBranch) {
      return (
        <>
          <span className="hover-only">
            {isExpanded ? <ChevronSmallDownIcon /> : <ChevronSmallRightIcon />}
          </span>
          <span className="static-only">
            <TypeIconWithSymbol type={item.type} />
          </span>
        </>
      );
    }

    return <TypeIconWithSymbol type={item.type} />;
  }, [item.type, isBranch, isExpanded]);

  const itemContent = (
    <StyledTreeItem
      $level={item.depth}
      $textColor={statusTextColor}
      textValue={item.name}
      aria-label={ariaLabel}
      id={id}
      data-item-id={item.id}
      data-ref-id={refId}
    >
      <TreeItemContent>
        <StyledContent>
          <Traces level={item.depth} isAlongsideSelected={isAlongsideSelected} />
          {prefixAction}
          <StyledLabel>
            {item.renderLabel?.(item || [], api, { location }) || item.name}
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
