import React, { useCallback, useContext, useMemo } from 'react';

import type { StatusValue } from 'storybook/internal/types';

import { darken, transparentize } from 'polished';
import { TreeItem, TreeItemContent } from 'react-aria-components/Tree';
import type { API } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { getStatus } from '../../utils/status.tsx';
import { type TreeEntry, createId } from '../../utils/tree.ts';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { ContextMenu, hasContextMenu } from './ContextMenu.tsx';

import { TypeIconWithSymbol } from './TypeIcon.tsx';
import type { Item } from './types.ts';
import { StatusContext } from './StatusContext.tsx';
import { CollapseIcon } from './CollapseIcon.tsx';

// FIXME/TODO: Review with MA: shortcut styling in TooltipNote VS Figma
// -> Make it look good everywhere
// FIXME/TODO: Review with MA: check spacing between top level sections, possible inconsistency in Figma
// -> Add spacing when the above subtree is expanded 14px / .5 item
// -> Add even more spacing between refs and remove the divider 28px / 1 item
// FIXME/TODO: prevent line wrapping on long items?
// FIXME/TODO: dont let #storybook-explorer-menu be focused when there are no search results. It gets in the way of testing the tree
// FIXME/TODO: we must find how to get PopoverProvider to autofocus the first menu item on menu open through RAC APIs.
// FIXME/TODO: if contextmenu trigger visible, add right padding to the label to prevent overlap; or better yet swap absolute layout for one with negative margins
// FIXME/TODO: ensure there is no weird behaviour with top-level stories / orphans
// FIXME/TODO: fix ref stories not loading at all

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
  cursor: 'pointer',

  // Indent based on tree level.
  paddingInlineStart: `calc(${$level} * 20px)`,

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
    anchorName: '--focused-treenode',
    zIndex: 1,
  },

  /* ContextMenu and StatusIcon visibility.
   * ContextMenu button is shown on hover/focus and when already open;
   * StatusIcon is hidden when ContextMenu button is visible. */
  '& [data-displayed="off"]': {
    visibility: 'hidden',
  },

  '&:hover [data-displayed="off"], &:focus-visible [data-displayed="off"], &:focus-within [data-displayed="off"]':
    {
      visibility: 'visible',
    },

  '& span:has([data-displayed="on"]) + *': {
    visibility: 'hidden',
  },

  '&:hover span:has([data-displayed="off"]) + *, &:focus-visible span:has([data-displayed="off"]) + *, &:focus-within span:has([data-displayed="off"]) + *':
    {
      visibility: 'hidden',
    },

  /* CollapseIcon and TypeIcon visibility.
   * Expand/collapse icon is shown instead of the TypeIcon on hover/focus. */
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

const MenuTriggerContainer = styled.span({
  position: 'absolute',
  insetY: 0,
  right: 0,
});

const StatusIconContainer = styled.span({
  transition: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  height: 24,
  gap: 4,
  padding: 5,
  zIndex: 1,
});

export type ContextMenuEntryMethod = 'pointer' | 'keyboard';

// FIXME/TODO: find what to do with orphans. Try trees with orphan items. Likely special treatment with lines.
export interface TreeNodeProps {
  /** The item for this TreeNode. */
  item: TreeEntry;
  /** refId of the composed Storybook, if the item isn't from the host instance. */
  refId: string;
  /** Whether this node has no parent and isn't a natural root. */
  isOrphan: boolean;
  /** Whether this node is currently selected. */
  isSelected: boolean;
  /** Whether this node is a direct sibling to the selected node. */
  isAlongsideSelected: boolean;
  /** Whether this node is currently expanded. */
  isExpanded: boolean;
  /** Callback to select a story by its ID. */
  onSelectStoryId: (itemId: string) => void;
  api: API;
  /** Whether this item's context menu is currently open. */
  isContextMenuOpen: boolean;
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

function guardHasContextMenu(contextMenu: React.ReactNode | null): contextMenu is React.ReactNode {
  return contextMenu !== null;
}

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
  isAlongsideSelected,
  isExpanded,
  api,
  onSelectStoryId,
  isContextMenuOpen,
  contextMenuEntryMethod,
  openContextMenu,
  closeContextMenu,
  children,
}) {
  const theme = useTheme();
  const id = useMemo(() => createId(item.id, refId), [item.id, refId]);
  const { groupDualStatus } = useContext(StatusContext);
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

  // Get all status icons for this node.
  const { changeStatus, changeStatusIcon, testStatus, testStatusIcon, statusTextColor } = useMemo<{
    changeStatus: StatusValue;
    changeStatusIcon: React.ReactNode | null;
    testStatus: StatusValue;
    testStatusIcon: React.ReactNode | null;
    statusTextColor: string | null;
  }>(() => {
    if (!groupDualStatus || !groupDualStatus[item.id]) {
      return {
        changeStatus: 'status-value:unknown',
        changeStatusIcon: null,
        testStatus: 'status-value:unknown',
        testStatusIcon: null,
        statusTextColor: null,
      };
    }

    const changeStatus = groupDualStatus[item.id].change;
    const testStatus = groupDualStatus[item.id].test;

    const { icon: changeStatusIcon, textColor: changeTextColor } = getStatus(
      theme,
      changeStatus.value
    );
    const { icon: testStatusIcon, textColor: testTextColor } = getStatus(theme, testStatus.value);

    return {
      changeStatus: changeStatus.value,
      changeStatusIcon,
      testStatus: testStatus.value,
      testStatusIcon,
      statusTextColor: testTextColor ?? changeTextColor,
    };
  }, [groupDualStatus, item.id, theme]);

  const isBranch = guardHasChildren(item);
  const renderContextMenu = useMemo(() => hasContextMenu(item), [item]);
  const shortcutKeys = api.getShortcutKeys();

  // Compute final aria-label including test status and keyboard shortcut discovery.
  const ariaLabel = useMemo(() => {
    let label = item.renderAriaLabel?.(item, api, { location }) || item.name;

    if (testStatus !== 'status-value:unknown') {
      label += `. ${StatusLabelsInAriaLabel[testStatus]}`;
    }

    if (changeStatus !== 'status-value:unknown') {
      label += `. ${StatusLabelsInAriaLabel[changeStatus]}`;
    }

    if (renderContextMenu) {
      const shortcut = shortcutToHumanString(shortcutKeys.contextMenu);
      label += `. Press ${shortcut} for more actions`;
    }
    return label;
  }, [item, api, location, renderContextMenu, changeStatus, testStatus, shortcutKeys]);

  const prefixAction = useMemo(() => {
    if (item.type === 'root') {
      return <CollapseIcon isExpanded={isExpanded} />;
    }

    if (isBranch) {
      return (
        <>
          <span className="hover-only">{<CollapseIcon isExpanded={isExpanded} />}</span>
          <span className="static-only">
            <TypeIconWithSymbol item={item} />
          </span>
        </>
      );
    }

    return <TypeIconWithSymbol item={item} />;
  }, [item, isBranch, isExpanded]);

  const itemContent = (
    <StyledTreeItem
      $level={item.depth}
      $textColor={statusTextColor}
      textValue={item.name}
      aria-label={ariaLabel}
      id={id}
      key={id}
      data-item-id={item.id}
      data-ref-id={refId}
    >
      <TreeItemContent>
        <StyledContent>
          <Traces level={item.depth} isAlongsideSelected={isAlongsideSelected} />
          {prefixAction}
          <StyledLabel>{item.renderLabel?.(item, api, { location }) || item.name}</StyledLabel>
          {renderContextMenu && (
            <MenuTriggerContainer>
              {
                <ContextMenu
                  context={item}
                  isOpen={isContextMenuOpen}
                  setIsOpen={handleContextMenuOpenChange}
                  onSelectStoryId={onSelectStoryId}
                  api={api}
                  entryMethod={contextMenuEntryMethod}
                />
              }
            </MenuTriggerContainer>
          )}
          {(changeStatusIcon || testStatusIcon) && (
            <StatusIconContainer role="status" aria-live="off" data-testid="tree-status-button">
              {changeStatusIcon}
              {testStatusIcon}
            </StatusIconContainer>
          )}
        </StyledContent>
      </TreeItemContent>
      {children}
    </StyledTreeItem>
  );

  return itemContent;
});
