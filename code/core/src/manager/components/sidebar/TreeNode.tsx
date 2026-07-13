import React, { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import { Addon_TypesEnum, type StatusValue } from 'storybook/internal/types';

import { darken, transparentize } from 'polished';
import { TreeItem, TreeItemContent } from 'react-aria-components/Tree';
import type { API } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { getStatus, shouldShowChangeStatus } from '../../utils/status.tsx';
import { type TreeEntry, createId } from '../../utils/tree.ts';
import { useLayout } from '../layout/LayoutProvider.tsx';
import { ContextMenu, generateTestProviderLinks, hasContextMenu } from './ContextMenu.tsx';

import { CollapseIcon } from './CollapseIcon.tsx';
import { RowUiContext } from './RowUiContext.tsx';
import { StatusContext } from './StatusContext.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';
import type { Item } from './types.ts';

// FIXME/TODO: ensure there is no weird behaviour with top-level stories / orphans
// FIXME/TODO: fix ref stories not loading at all

/** Height of a tree row in px. Rows are single-line (labels ellipsize), so this is constant. */
export const TREE_ROW_HEIGHT = 28;

/** Gap above a top-level section that follows another section's subtree, carried as row padding. */
export const SECTION_GAP = 14;

const StyledTreeItem = styled(TreeItem)<{
  $level: number;
  $textColor: string | null;
  $hasSectionGap: boolean;
}>(({ $level, theme, $textColor, $hasSectionGap }) => ({
  // General layout.
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: 'transparent',
  minHeight: TREE_ROW_HEIGHT,
  overflow: 'hidden',
  cursor: 'pointer',

  // Indent based on tree level.
  paddingInlineStart: `calc(${$level} * 20px)`,

  // Inter-section spacing, carried by the section-start row itself: the tree is virtualized
  // (rows are absolutely positioned), so sibling margins cannot create the gap.
  paddingBlockStart: $hasSectionGap ? SECTION_GAP : 0,

  // Hover/selection/focus decorations paint on this inner surface, which excludes the
  // section-gap padding — painting them on the row itself would bleed into the gap.
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: $hasSectionGap ? SECTION_GAP : 0,
    borderRadius: 4,
    pointerEvents: 'none',
  },

  // Base colors.
  color: $textColor ?? theme.color.defaultText,
  '--trace-color': theme.appBorderColor,
  a: { color: $textColor ?? 'currentColor' },

  // Hover colors: data-focused is set by RAC on hovered items (it mixes hover/focus states).
  '&:hover, &[data-focused="true"]': {
    color: $textColor ?? theme.barHoverColor,
    outline: 'none',
    '--trace-color': transparentize(0.52, theme.color.secondary),
    svg: { color: 'currentColor' },
  },
  '&:hover::before, &[data-focused="true"]::before': {
    background: theme.background.hoverable,
  },

  // Selected colors.
  '&[data-selected="true"]': {
    color: theme.color.lightest,
    fontWeight: theme.typography.weight.bold,
    svg: { color: theme.color.lightest },
  },
  '&[data-selected="true"]::before': {
    background: theme.base === 'dark' ? darken(0.18, theme.color.secondary) : theme.color.secondary,
  },

  // Focus colors. The ring is inset so neighboring rows and the scroller edges never crop it.
  '&:focus-visible': {
    outline: 'none',
    '--trace-color': transparentize(0.88, theme.color.secondary),
    anchorName: '--focused-treenode',
    zIndex: 1,
  },
  '&:focus-visible::before': {
    boxShadow: `inset 0 0 0 2px ${theme.color.secondary}, inset 0 0 0 4px ${theme.background.app}`,
  },

  /* ContextMenu and StatusIcon visibility.
   * ContextMenu button is shown on hover/focus and when already open;
   * StatusIcon is hidden when ContextMenu button is visible. */
  '& [data-displayed="off"]': {
    display: 'none',
  },

  '&:hover [data-displayed="off"], &:focus-visible [data-displayed="off"], &:focus-within [data-displayed="off"]':
    {
      display: 'block',
    },

  '& span:has([data-displayed="on"]) + *': {
    display: 'none',
  },

  '&:hover span:has([data-displayed="off"]) + *, &:focus-visible span:has([data-displayed="off"]) + *, &:focus-within span:has([data-displayed="off"]) + *':
    {
      display: 'none',
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

export const Traces = ({
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
  minWidth: 0,
  marginInlineStart: 6,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const MenuTriggerContainer = styled.span({
  margin: -2,
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
  /** Whether this node is currently expanded. */
  isExpanded: boolean;
  /** Whether this row starts a new top-level section and carries the inter-section gap. */
  hasSectionGap?: boolean;
  /** Callback to select a story by its ID. */
  onSelectStoryId: (itemId: string) => void;
  api: API;
  /** Open the context menu for a given item ID with the specified entry method. */
  openContextMenu?: (itemId: string, entryMethod: ContextMenuEntryMethod) => void;
  /** Close the currently-open context menu. */
  closeContextMenu?: () => void;
  /** Whether any test provider addon is registered (enables the menu on group rows). */
  hasTestProviders?: boolean;
  children?: React.ReactNode;
}

function guardHasChildren(item: Item): item is Item & { children: string[] } {
  return 'children' in item && Array.isArray(item.children) && item.children.length > 0;
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
  'status-value:reviewing': 'Included in the active review',
};

export const TreeNode = React.memo<TreeNodeProps>(function TreeNode({
  item,
  refId,
  isExpanded,
  hasSectionGap = false,
  api,
  onSelectStoryId,
  openContextMenu,
  closeContextMenu,
  hasTestProviders = false,
  children,
}) {
  const theme = useTheme();
  const id = useMemo(() => createId(item.id, refId), [item.id, refId]);
  const { groupDualStatus, isModifiedFilterActive = false } = useContext(StatusContext);

  // Selection accents and context-menu state come from a subscription store rather than props:
  // as react-aria collection dependencies they re-rendered every row in the tree on each
  // selection change. Only rows whose derived value changes re-render.
  const rowUi = useContext(RowUiContext);
  const isAlongsideSelected = useSyncExternalStore(
    rowUi.subscribe,
    () => item.type !== 'root' && rowUi.getState().selectedParentId === item.parent
  );
  const contextMenuEntryMethod = useSyncExternalStore(rowUi.subscribe, () => {
    const menu = rowUi.getState().contextMenu;
    return menu?.itemId === item.id ? menu.entryMethod : undefined;
  });
  const isContextMenuOpen = contextMenuEntryMethod !== undefined;
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

    // 'affected' is never surfaced as an icon, and 'modified' only while its filter is active.
    const showChangeStatus = shouldShowChangeStatus(changeStatus.value, isModifiedFilterActive);
    const { icon: changeStatusIcon, textColor: changeTextColor } = getStatus(
      theme,
      changeStatus.value
    );
    const { icon: testStatusIcon, textColor: testTextColor } = getStatus(theme, testStatus.value);

    return {
      changeStatus: showChangeStatus ? changeStatus.value : 'status-value:unknown',
      changeStatusIcon: showChangeStatus ? changeStatusIcon : null,
      testStatus: testStatus.value,
      testStatusIcon,
      statusTextColor: testTextColor ?? (showChangeStatus ? changeTextColor : null),
    };
  }, [groupDualStatus, item.id, theme, isModifiedFilterActive]);

  const isBranch = guardHasChildren(item);

  // Whether a registered test provider actually contributes menu content for THIS item —
  // gates the menu on group/component rows so the button never opens an empty popover.
  const providerMenuAvailable = useMemo(() => {
    if (!hasTestProviders || item.type === 'root') {
      return false;
    }
    return (
      generateTestProviderLinks(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER), item)
        .length > 0
    );
  }, [hasTestProviders, api, item]);

  const renderContextMenu = useMemo(
    () => hasContextMenu(item, providerMenuAvailable),
    [item, providerMenuAvailable]
  );
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

    // The context-menu shortcut may be absent, e.g. when shortcuts are disabled.
    if (renderContextMenu && shortcutKeys?.contextMenu) {
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

  return (
    <StyledTreeItem
      $level={item.depth}
      $textColor={statusTextColor}
      $hasSectionGap={hasSectionGap}
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
                  hasTestProviders={providerMenuAvailable}
                />
              }
            </MenuTriggerContainer>
          )}
          {(changeStatusIcon || testStatusIcon) && (
            <StatusIconContainer role="status" aria-live="off" data-testid="tree-status-button">
              {changeStatusIcon && (
                <span style={{ display: 'contents' }} data-testid="tree-change-status-button">
                  {changeStatusIcon}
                </span>
              )}
              {testStatusIcon && (
                <span style={{ display: 'contents' }} data-testid="tree-test-status-button">
                  {testStatusIcon}
                </span>
              )}
            </StatusIconContainer>
          )}
        </StyledContent>
      </TreeItemContent>
      {children}
    </StyledTreeItem>
  );
});
