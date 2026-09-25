import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import type { StatusValue } from 'storybook/internal/types';

import { darken, transparentize } from 'polished';
import { Button as AriaButton } from 'react-aria-components/Button';
import { TreeItem, TreeItemContent } from 'react-aria-components/Tree';
import type { API } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { getStatus, shouldShowChangeStatus } from '../../utils/status.tsx';
import { isBranch, type TreeEntry } from '../../utils/tree.ts';
import {
  ContextMenu,
  hasContextMenu,
  hasProviderMenuEntriesFor,
  type ContextMenuTrigger,
} from './ContextMenu.tsx';

import { CollapseIcon } from './CollapseIcon.tsx';
import { IndentLines, useSelectionLineLevel } from './TreeIndentLines.tsx';
import { ContextMenuStoreContext } from './ContextMenuStore.tsx';
import { StatusContext } from './StatusContext.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';
import type { Item, SidebarLabelContext } from './types.ts';
import { iconSwap, truncatedLabel } from './treeRowStyles.ts';
import {
  SECTION_GAP,
  TREE_CONTENT_INSET,
  TREE_INDENT_STEP,
  TREE_ROW_HEIGHT,
} from './treeGeometry.ts';

const StyledTreeItem = styled(TreeItem)<{
  $level: number;
  $textColor: string | null;
  $startsSection: boolean;
}>(({ $level, theme, $textColor, $startsSection }) => ({
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
  paddingInlineStart: `calc(${$level} * ${TREE_INDENT_STEP}px)`,

  // Inter-section spacing, carried by the section-start row itself: the tree is virtualized
  // (rows are absolutely positioned), so sibling margins cannot create the gap.
  paddingBlockStart: $startsSection ? SECTION_GAP : 0,

  // Hover/selection/focus decorations paint on this inner surface, which excludes the
  // section-gap padding — painting them on the row itself would bleed into the gap.
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: $startsSection ? SECTION_GAP : 0,
    borderRadius: 4,
    pointerEvents: 'none',
  },

  // Base colors.
  color: $textColor ?? theme.color.defaultText,

  // Hover colors. React-aria keeps data-focused on a row that a pointer press focused, long after
  // the pointer has left it, so the highlight follows the pointer and the keyboard focus ring
  // instead: data-focus-visible marks keyboard focus only.
  '&:hover, &[data-focus-visible]': {
    color: $textColor ?? theme.barHoverColor,
    outline: 'none',
    svg: { color: 'currentColor' },
  },
  '&:hover [data-indent-line], &[data-focus-visible] [data-indent-line]': {
    backgroundColor: transparentize(0.52, theme.color.secondary),
  },
  '&:hover::before, &[data-focus-visible]::before': {
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
      display: 'inline-flex',
    },

  '& span:has([data-displayed="on"]) + *': {
    display: 'none',
  },

  '&:hover span:has([data-displayed="off"]) + *, &:focus-visible span:has([data-displayed="off"]) + *, &:focus-within span:has([data-displayed="off"]) + *':
    {
      display: 'none',
    },

  // Show the expand/collapse icon instead of the type icon while the row is active.
  ...iconSwap(['&:hover', '&:focus-visible']),
}));

const StyledContent = styled.div({
  // NOTE: we don't use gap because of the invisible SkipLink
  display: 'flex',
  minWidth: 28,
  minHeight: 28,
  padding: 2,
  paddingInlineStart: TREE_CONTENT_INSET,
  justifyContent: 'center',
  alignItems: 'center',
  flex: '1 0 0',
  position: 'relative',
});

const StyledLabel = styled.span({
  ...truncatedLabel,
  marginInlineStart: 6,
});

const MenuTriggerContainer = styled.span({
  margin: -2,
});

// react-aria requires expandable rows to carry a `slot="chevron"` Button so assistive
// technology gets a dedicated expand/collapse target; row-level visuals stay in charge, so
// the button itself is chromeless and the row paints focus.
const ExpandToggleButton = styled(AriaButton)({
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
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

export interface TreeNodeProps {
  /** The item for this TreeNode. */
  item: TreeEntry;
  /** refId of the composed Storybook, if the item isn't from the host instance. */
  refId: string;
  /** Passed to `renderLabel` and `renderAriaLabel`, so that every row reports the same context. */
  labelContext: SidebarLabelContext;
  /** Whether this node is currently expanded. */
  isExpanded: boolean;
  /** Whether this row starts a new top-level section and carries the inter-section gap. */
  startsSection?: boolean;
  /** Callback to select a story by its ID. */
  onSelectStoryId: (itemId: string) => void;
  api: API;
  /**
   * Open the context menu for a given item ID. When `openedBy` is omitted the tree derives it
   * from the last input modality (keyboard vs pointer); pass it explicitly for the global shortcut.
   */
  openContextMenu?: (itemId: string, openedBy?: ContextMenuTrigger) => void;
  /** Close the currently-open context menu. */
  closeContextMenu?: () => void;
  /** Whether any test provider addon is registered (enables the menu on group rows). */
  hasTestProviders?: boolean;
  children?: React.ReactNode;
}

const STATUS_ANNOUNCEMENTS: Record<StatusValue, string> = {
  'status-value:success': 'Tests passing',
  'status-value:error': 'Tests failing',
  'status-value:warning': 'Tests passing with warnings',
  'status-value:pending': 'Test status pending',
  'status-value:unknown': 'Test status unknown',
  'status-value:new': 'Has new stories',
  'status-value:modified': 'Has modified stories',
  'status-value:affected': 'Affected by other changes',
  'status-value:reviewing': 'Included in the active review',
};

export const TreeNode = React.memo<TreeNodeProps>(function TreeNode({
  item,
  refId,
  labelContext,
  isExpanded,
  startsSection = false,
  api,
  onSelectStoryId,
  openContextMenu,
  closeContextMenu,
  hasTestProviders = false,
  children,
}) {
  const theme = useTheme();
  const { groupDualStatus, isModifiedFilterActive = false } = useContext(StatusContext);

  // The open context menu comes from a subscription store, not from props. As a react-aria
  // collection dependency it invalidates the node cache, which re-renders every row in the tree.
  // With the store, only the row that opens or closes its menu re-renders.
  const selectionLineLevel = useSelectionLineLevel(item.id);
  const menuStore = useContext(ContextMenuStoreContext);
  const openedBy = useSyncExternalStore(menuStore.subscribe, () => {
    const menu = menuStore.getState();
    return menu?.itemId === item.id ? menu.openedBy : undefined;
  });
  const isContextMenuOpen = openedBy !== undefined;
  const stopRowPress = useCallback((event: React.SyntheticEvent) => event.stopPropagation(), []);

  // Record how the open menu is dismissed. The tree's own modality listeners cannot see the
  // dismissal: an outside click lands beyond the tree, and Escape lands in the portaled popover.
  const dismissedByPointerRef = useRef(false);
  useEffect(() => {
    if (!isContextMenuOpen) {
      return;
    }
    const doc = globalThis.document;
    const onPointerDown = () => (dismissedByPointerRef.current = true);
    const onKeyDown = () => (dismissedByPointerRef.current = false);
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('keydown', onKeyDown, true);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown, true);
      doc.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isContextMenuOpen]);

  // Toggles the context menu open/close, suitable as the `setIsOpen` parameter for the popover.
  // The entry method (pointer vs keyboard) is derived by the tree from the last input modality,
  // so Enter/Space on the ⋯ button count as keyboard entry while a mouse click counts as pointer.
  //
  // When the closing popover held focus, react-aria restores it to the row or the ⋯ trigger,
  // even after the focus already left for the body. That restore is right for Escape, which
  // returns keyboard users to the row, and wrong for a pointer dismissal, where it keeps the row
  // in its focused look although the user pressed elsewhere. The restore lands after an
  // animation frame of react-aria's own, so a pointer dismissal watches for it through focusin
  // and blurs it as it arrives.
  const handleContextMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openContextMenu?.(item.id);
        return;
      }
      closeContextMenu?.();
      if (!dismissedByPointerRef.current) {
        return;
      }
      const doc = globalThis.document;
      const row = doc.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`);
      const cancel = () => {
        doc.removeEventListener('focusin', onFocusIn, true);
        clearTimeout(timer);
      };
      const onFocusIn = (event: FocusEvent) => {
        // Layered focus scopes restore more than once, so stay armed for the whole window and
        // stand down only when focus lands somewhere else on purpose.
        if (event.target instanceof HTMLElement && row?.contains(event.target)) {
          event.target.blur();
          return;
        }
        cancel();
      };
      doc.addEventListener('focusin', onFocusIn, true);
      const timer = setTimeout(cancel, 500);
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

  const itemIsBranch = isBranch(item);

  // The row type that addons and end-to-end tests select on. A test entry reports its subtype, and
  // a docs entry reports 'document'.
  const nodeType =
    'subtype' in item && item.subtype === 'test'
      ? 'test'
      : item.type === 'docs'
        ? 'document'
        : item.type;

  const hasProviderMenuEntries = useMemo(
    () => hasProviderMenuEntriesFor(api, item, hasTestProviders),
    [api, item, hasTestProviders]
  );

  const renderContextMenu = useMemo(
    () => hasContextMenu(item, hasProviderMenuEntries),
    [item, hasProviderMenuEntries]
  );
  const shortcutKeys = api.getShortcutKeys();

  // Compute final aria-label including test status and keyboard shortcut discovery.
  const ariaLabel = useMemo(() => {
    let label = item.renderAriaLabel?.(item, api, labelContext) || item.name;

    if (testStatus !== 'status-value:unknown') {
      label += `. ${STATUS_ANNOUNCEMENTS[testStatus]}`;
    }

    if (changeStatus !== 'status-value:unknown') {
      label += `. ${STATUS_ANNOUNCEMENTS[changeStatus]}`;
    }

    // The context-menu shortcut may be absent, e.g. when shortcuts are disabled.
    if (renderContextMenu && shortcutKeys?.contextMenu) {
      const shortcut = shortcutToHumanString(shortcutKeys.contextMenu);
      label += `. Press ${shortcut} for more actions`;
    }
    return label;
  }, [item, api, labelContext, renderContextMenu, changeStatus, testStatus, shortcutKeys]);

  const leadingIcon = useMemo(() => {
    if (item.type === 'root') {
      return (
        <ExpandToggleButton slot="chevron" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          <CollapseIcon isExpanded={isExpanded} />
        </ExpandToggleButton>
      );
    }

    if (itemIsBranch) {
      return (
        <ExpandToggleButton slot="chevron" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          <span className="hover-only">{<CollapseIcon isExpanded={isExpanded} />}</span>
          <span className="static-only">
            <TypeIconWithSymbol item={item} />
          </span>
        </ExpandToggleButton>
      );
    }

    return <TypeIconWithSymbol item={item} />;
  }, [item, itemIsBranch, isExpanded]);

  return (
    <StyledTreeItem
      $level={item.depth}
      $textColor={statusTextColor}
      $startsSection={startsSection}
      textValue={item.name}
      aria-label={ariaLabel}
      // The collection key must be the raw entry id: selection, expansion, and the delegated
      // DOM handlers all resolve keys against the index hash. Each ref renders its own tree
      // (its own collection), so ids need no cross-ref disambiguation.
      id={item.id}
      key={item.id}
      // Addons and end-to-end tests select rows by these attributes.
      className={item.type === 'root' ? 'sidebar-subheading' : 'sidebar-item'}
      data-item-id={item.id}
      data-ref-id={refId}
      data-nodetype={nodeType}
    >
      <TreeItemContent>
        <IndentLines level={item.depth} selectionLevel={selectionLineLevel} />
        <StyledContent>
          {leadingIcon}
          <StyledLabel>{item.renderLabel?.(item, api, labelContext) || item.name}</StyledLabel>
          {renderContextMenu && (
            // react-aria selects rows on pointerdown; the press that opens the menu must not
            // also activate the row underneath (navigate, or fold the branch under the menu).
            <MenuTriggerContainer
              onPointerDown={stopRowPress}
              onMouseDown={stopRowPress}
              onTouchStart={stopRowPress}
            >
              {
                <ContextMenu
                  context={item}
                  isOpen={isContextMenuOpen}
                  setIsOpen={handleContextMenuOpenChange}
                  onSelectStoryId={onSelectStoryId}
                  api={api}
                  openedBy={openedBy}
                  hasProviderMenuEntries={hasProviderMenuEntries}
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
