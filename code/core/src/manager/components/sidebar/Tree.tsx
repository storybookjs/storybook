import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TooltipNote } from 'storybook/internal/components';
import { PRELOAD_ENTRIES, SIDEBAR_OPEN_CONTEXT_MENU } from 'storybook/internal/core-events';

import { Collection } from 'react-aria-components/Collection';
import { Tree as AriaTree } from 'react-aria-components/Tree';
import { ListLayout, Virtualizer } from 'react-aria-components/Virtualizer';

import {
  getAncestorIds,
  hoistSingleStoryComponents,
  indexToTree,
  isBranch,
  type TreeEntry,
} from '../../utils/tree.ts';
import { TreeNode, type TreeNodeProps } from './TreeNode.tsx';

import {
  Addon_TypesEnum,
  type StatusValue,
  type StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { transparentize } from 'polished';
import { shortcutToHumanString, useStorybookApi, type IndexHash } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants.ts';
import { getGroupDualStatus } from '../../utils/status.tsx';
import { useLayout } from '../layout/LayoutProvider.tsx';
import type { ContextMenuTrigger } from './ContextMenu.tsx';
import { hasContextMenu, hasProviderMenuEntriesFor } from './ContextMenu.tsx';
import {
  ContextMenuStoreContext,
  createContextMenuStore,
  type ContextMenuStore,
} from './ContextMenuStore.tsx';
import { StatusContext } from './StatusContext.tsx';
import { INDENT_LINE_OPACITY_VAR, useIndentLines, type HoveredRow } from './TreeIndentLines.tsx';
import { TreeStickyRows, getStickyRowIds } from './TreeStickyRows.tsx';
import type { SidebarLabelContext } from './types.ts';
import { useExpanded } from './useExpanded.ts';
import { TREE_ROW_HEIGHT, flattenRows } from './treeGeometry.ts';

const StyledAriaTree = styled(AriaTree)(({ theme }) => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  outline: 'none',
  // The virtualizer makes the tree its own scroll container; the parent must bound its height.
  height: '100%',
  overflow: 'auto',
  // Reserve room under the floating sidebar-bottom widget (its measured height, published as a
  // CSS variable) so the last rows can scroll clear of it. 0 when no widget is mounted.
  paddingBottom: 'var(--sidebar-bottom-height, 0px)',

  // Match the ScrollArea look: a thin muted thumb on a transparent track, only visible while
  // hovering or keyboard-focused inside the tree.
  scrollbarWidth: 'thin',
  scrollbarColor: 'transparent transparent',
  '&::-webkit-scrollbar': {
    width: 6,
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  '&:hover, &:focus-within': {
    scrollbarColor: `${transparentize(0.5, theme.textMutedColor)} transparent`,
  },
  '&:hover::-webkit-scrollbar-thumb, &:focus-within::-webkit-scrollbar-thumb': {
    backgroundColor: transparentize(0.5, theme.textMutedColor),
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: transparentize(0.2, theme.textMutedColor),
  },
}));

const TreeWrapper = styled.div(({ theme }) => ({
  position: 'relative',
  height: '100%',
  minHeight: 0,
  // Contain the z-index of the overlays, so that UI outside the tree still paints above them.
  isolation: 'isolate',
  '--sticky-row-background': theme.background.content,
  // Show the indent lines only while the pointer is over the tree, or while a row holds keyboard
  // focus. The selection line has its own path and ignores this.
  '&:hover, &:has(:focus-visible)': {
    [INDENT_LINE_OPACITY_VAR]: 1,
  },
  [MEDIA_DESKTOP_BREAKPOINT]: {
    '--sticky-row-background': theme.background.app,
  },
  // Soft fade at the bottom of the scroll area, easing the cut-off into the rest of the UI.
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    pointerEvents: 'none',
    background: 'linear-gradient(to top, var(--sticky-row-background), transparent)',
  },
}));

// Without CSS anchor positioning the note cannot follow the focused row, and without
// `position-visibility` (not yet in Chrome) nothing hides it while no row holds the anchor
// (mouse focus is not :focus-visible) — either way it would sit as a stray pill over the
// sidebar, so it only renders where both work.
const supportsAnchorPositioning =
  typeof CSS !== 'undefined' &&
  !!CSS.supports?.('anchor-name: --sb-probe') &&
  !!CSS.supports?.('position-visibility: anchors-valid');

const FocusTooltipNote = styled(TooltipNote)({
  marginBlockStart: 8,
  marginInlineEnd: -4,
  position: 'fixed',
  zIndex: 2,
  positionAnchor: '--focused-treenode',
  positionArea: 'span-x-start y-end',
  positionVisibility: 'anchors-valid',
});

interface TreeProps {
  allStatuses?: StatusesByStoryIdAndTypeId;
  /** Active inclusive status filters; passed as a prop so Tree doesn't subscribe to all state. */
  includedStatusFilters?: StatusValue[];
  refId: string;
  data: IndexHash;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}

export const Tree = React.memo<TreeProps>(function Tree({
  allStatuses: allStatusesProp,
  includedStatusFilters,
  refId,
  data: dataProp,
  selectedStoryId,
  onSelectStoryId: onSelectStoryIdProp,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const treeWrapperRef = useRef<HTMLDivElement>(null);
  const api = useStorybookApi();
  const { isMobile } = useLayout();
  const labelContext = useMemo<SidebarLabelContext>(
    () => ({ isMobile, location: 'sidebar' }),
    [isMobile]
  );
  const isModifiedFilterActive = (includedStatusFilters ?? []).includes('status-value:modified');
  // Whether any test provider is registered: gates the context menu on group/component rows.
  const hasTestProviders =
    Object.keys(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER)).length > 0;

  // The manager recreates the index and status records on unrelated state ticks. Their
  // identities feed the react-aria collection (items + dependencies) and the status context,
  // where a fresh identity re-renders every row in the tree — seconds when fully expanded.
  // Reuse the previous identity while the entries themselves are unchanged.
  const data = useStableIdentity(dataProp);
  const allStatuses = useStableIdentity(allStatusesProp);

  // Keep the selection callback identity stable for the same reason: it feeds the memoized
  // row renderer.
  const onSelectStoryIdRef = useRef(onSelectStoryIdProp);
  onSelectStoryIdRef.current = onSelectStoryIdProp;
  const onSelectStoryId = useCallback((id: string) => onSelectStoryIdRef.current(id), []);

  // The row that holds DOM focus, which the context-menu shortcut acts on. React-aria keeps this
  // on a row that a pointer press focused, so it is not the row the user is looking at.
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const focusedItemIdRef = useRef<string | null>(null);

  // The row that holds keyboard focus. React-aria marks it with data-focus-visible, which a
  // pointer press never sets, so the indent lines mark it and no other row.
  const [keyboardFocusedItemId, setKeyboardFocusedItemId] = useState<string | null>(null);

  // Rewrite the dataset to place the single child story in place of the component.
  const hoistedData = useMemo(() => hoistSingleStoryComponents(data), [data]);

  // Switch to a tree structure from now on.
  const tree = useMemo(() => indexToTree(hoistedData), [hoistedData]);

  // Track expanded nodes, keep it in sync with props and enable keyboard shortcuts.
  const [expanded, setExpanded] = useExpanded({
    data: hoistedData,
    selectedStoryId,
  });

  const groupDualStatus = useMemo(
    () => getGroupDualStatus(hoistedData, allStatuses ?? {}),
    [hoistedData, allStatuses]
  );

  const contextMenuShortcut = useMemo(() => {
    const shortcutKeys = api.getShortcutKeys();
    if (!shortcutKeys?.contextMenu) {
      return undefined;
    }

    return shortcutToHumanString(shortcutKeys.contextMenu);
  }, [api]);

  // The note that tells the user which shortcut opens the actions of the focused row. Rows compute
  // the same availability for their own ⋯ button (see TreeNode).
  const focusedItemShortcutLabel = useMemo(() => {
    if (!supportsAnchorPositioning || !focusedItemId || !contextMenuShortcut) {
      return null;
    }

    const item = hoistedData[focusedItemId];
    if (!item) {
      return null;
    }

    if (!hasContextMenu(item, hasProviderMenuEntriesFor(api, item, hasTestProviders))) {
      return null;
    }

    const itemStatus = groupDualStatus?.[focusedItemId];
    const changeStatus = itemStatus?.change.value ?? 'status-value:unknown';
    const testStatus = itemStatus?.test.value ?? 'status-value:unknown';

    return changeStatus !== 'status-value:unknown' || testStatus !== 'status-value:unknown'
      ? 'Status and actions'
      : 'Actions';
  }, [focusedItemId, contextMenuShortcut, hoistedData, groupDualStatus, hasTestProviders, api]);

  // React-aria expects a Set for selectedKeys. Memoize so Tree's children see a stable ref.
  const selectedKeys = useMemo(
    () => (selectedStoryId ? new Set([selectedStoryId]) : EMPTY_KEYS),
    [selectedStoryId]
  );

  // The children of this row share the selection line in the indent layer.
  const selectedParentId = useMemo(() => {
    const entry = selectedStoryId ? hoistedData[selectedStoryId] : undefined;
    return !entry || entry.type === 'root' ? null : (entry.parent ?? null);
  }, [selectedStoryId, hoistedData]);

  // Stable handlers so children (especially TreeNode) can rely on prop identity.
  const handleExpandedChange = useCallback(
    (keys: Set<React.Key>) => {
      setExpanded({ ids: Array.from(keys).map(String) });
    },
    [setExpanded]
  );

  // react-aria's selectionBehavior="replace" makes selection follow focus, so onSelectionChange
  // fires as focus moves (arrow keys, Tab, programmatic focus) — not only on genuine activation.
  // Acting on those would expand/collapse a branch or navigate a story merely because focus
  // landed on the row. This flag is true only while a pointer press or Space keypress is being
  // handled on the tree, so handleSelectionChange can ignore focus-driven changes. Enter and
  // double-click activate through onAction, which fires regardless.
  const isActivatingRef = useRef(false);
  // The modality of the last input inside the tree. The ⋯ button opens its menu through
  // react-aria's press handling, which doesn't tell us whether it was a click or Enter/Space, so
  // the capture-phase listeners below record it: opening the menu via keyboard autofocuses the
  // first item, while a mouse click does not.
  const lastInputModalityRef = useRef<ContextMenuTrigger>('pointer');
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const onInputStart = (event: PointerEvent | KeyboardEvent) => {
      lastInputModalityRef.current = event.type === 'pointerdown' ? 'pointer' : 'keyboard';
      if (event.type === 'pointerdown' || (event as KeyboardEvent).key === ' ') {
        isActivatingRef.current = true;
      }
    };
    const onInputEnd = () => {
      isActivatingRef.current = false;
    };
    container.addEventListener('pointerdown', onInputStart, { capture: true });
    container.addEventListener('keydown', onInputStart, { capture: true });
    // pointerup can land outside the row (or the tree) after a drag, so listen on the window.
    window.addEventListener('pointerup', onInputEnd, { capture: true });
    container.addEventListener('keyup', onInputEnd, { capture: true });
    return () => {
      container.removeEventListener('pointerdown', onInputStart, { capture: true });
      container.removeEventListener('keydown', onInputStart, { capture: true });
      window.removeEventListener('pointerup', onInputEnd, { capture: true });
      container.removeEventListener('keyup', onInputEnd, { capture: true });
    };
  }, []);

  // Use refs so the callbacks below can read the latest values without re-creating.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const hoistedDataRef = useRef(hoistedData);
  hoistedDataRef.current = hoistedData;
  const selectedStoryIdRef = useRef(selectedStoryId);
  selectedStoryIdRef.current = selectedStoryId;

  const updateFocusedItemId = useCallback((itemId: string | null) => {
    focusedItemIdRef.current = itemId;
    setFocusedItemId(itemId);
  }, []);

  // A branch toggles its own expansion. A leaf navigates to its story or docs page.
  const activateRow = useCallback(
    (itemId: string) => {
      const item = hoistedDataRef.current[itemId];
      if (item && isBranch(item)) {
        setExpanded({ ids: [itemId], append: true, value: !expandedRef.current.has(itemId) });
      } else {
        onSelectStoryId(itemId);
      }
    },
    [onSelectStoryId, setExpanded]
  );

  // A pointer click and Space both reach the tree as a selection change.
  const handleSelectionChange = useCallback(
    (keys: 'all' | Set<React.Key>) => {
      if (keys === 'all') {
        return;
      }
      // Ignore selection changes that merely follow focus (arrow keys, Tab, programmatic focus):
      // only a pointer press or Space activates a row. Otherwise navigating past a branch would
      // toggle its expansion. See isActivatingRef.
      if (!isActivatingRef.current) {
        return;
      }
      const selectedKey = Array.from(keys)[0];
      if (typeof selectedKey === 'string') {
        activateRow(selectedKey);
      }
    },
    [activateRow]
  );

  // Enter and a double click reach the tree as an action.
  const handleAction = useCallback((key: React.Key) => activateRow(String(key)), [activateRow]);

  // The open menu lives in a store rather than in React state: the tree renders nothing from it,
  // and only the row that opens or closes its menu needs to re-render (see ContextMenuStore).
  const contextMenuStoreRef = useRef<ContextMenuStore | null>(null);
  contextMenuStoreRef.current ??= createContextMenuStore();

  // Open or close the context menu. Stable callbacks for children. When the caller does not name an
  // opener (the ⋯ button), take the last input modality, so that Enter and Space open the menu with
  // keyboard semantics and a mouse click opens it with pointer semantics.
  const openContextMenu = useCallback((itemId: string, openedBy?: ContextMenuTrigger) => {
    contextMenuStoreRef.current!.setState({
      itemId,
      openedBy: openedBy ?? lastInputModalityRef.current,
    });
  }, []);
  const closeContextMenu = useCallback(() => contextMenuStoreRef.current!.setState(null), []);

  // Track both focus marks with one MutationObserver. React-aria sets data-focused on the row
  // that holds DOM focus, and data-focus-visible only while the focus came from the keyboard.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const idOf = (selector: string) =>
      container.querySelector<HTMLElement>(selector)?.getAttribute('data-item-id') ?? null;
    updateFocusedItemId(idOf('[data-focused="true"][data-item-id]'));
    setKeyboardFocusedItemId(idOf('[data-focus-visible][data-item-id]'));

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const row = mutation.target;
        if (!(row instanceof HTMLElement)) {
          continue;
        }
        const itemId = row.getAttribute('data-item-id');
        if (mutation.attributeName === 'data-focused') {
          if (row.getAttribute('data-focused') === 'true') {
            updateFocusedItemId(itemId);
          } else if (focusedItemIdRef.current === itemId) {
            updateFocusedItemId(null);
          }
        } else if (row.hasAttribute('data-focus-visible')) {
          setKeyboardFocusedItemId(itemId);
        } else {
          setKeyboardFocusedItemId((current) => (current === itemId ? null : current));
        }
      }
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['data-focused', 'data-focus-visible'],
      subtree: true,
    });

    return () => observer.disconnect();
  }, [updateFocusedItemId]);

  // Geometry of the visible rows, in render order.
  const rows = useMemo(() => flattenRows(tree, expanded), [tree, expanded]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // The ancestors of the top row, kept in view above the tree.
  const [stickyIds, setStickyIds] = useState<string[]>([]);
  const stickyIdsRef = useRef<string[]>([]);

  // The row under the pointer. The indent lines mark it, and the tree preloads its first story.
  const hoveredRowRef = useRef<HoveredRow | null>(null);

  const { layer: indentLines, redraw: redrawIndentLines } = useIndentLines({
    scrollerRef: containerRef,
    rowsRef,
    stickyIdsRef,
    hoveredRowRef,
    keyboardFocusedItemId,
    selectedParentId,
  });

  // Recompute the sticky rows and the indent lines on every scroll, and whenever the geometry
  // changes. A resize alone can reveal rows, so the scroller is observed as well.
  useEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) {
      return;
    }
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const stickyRowIds = getStickyRowIds(
        rowsRef.current,
        hoistedDataRef.current,
        scroller.scrollTop
      );
      stickyIdsRef.current = stickyRowIds;
      setStickyIds((current) =>
        current.length === stickyRowIds.length &&
        current.every((id, index) => id === stickyRowIds[index])
          ? current
          : stickyRowIds
      );
      redrawIndentLines();
    };
    const scheduleUpdate = () => {
      frame ??= requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', scheduleUpdate, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', scheduleUpdate);
      resizeObserver.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [rows, redrawIndentLines]);

  // One delegated listener for everything the hovered row drives: the accent indent line, and the
  // preload of the first story of a branch. It sits on the wrapper, so it also sees the sticky
  // rows, which are outside the scroller.
  useEffect(() => {
    const wrapper = treeWrapperRef.current;
    if (!wrapper) {
      return;
    }
    let preloadedId: string | null = null;
    const setHovered = (next: HoveredRow | null) => {
      const previous = hoveredRowRef.current;
      if (previous?.id === next?.id && previous?.sticky === next?.sticky) {
        return;
      }
      hoveredRowRef.current = next;
      redrawIndentLines();

      const item = next && !next.sticky ? hoistedDataRef.current[next.id] : undefined;
      if (item && next!.id !== preloadedId && isBranch(item)) {
        preloadedId = next!.id;
        // The preview has then usually started to load by the time the user clicks.
        api.emit(PRELOAD_ENTRIES, { ids: [item.children[0]], options: { target: refId } });
      }
    };
    const onOver = (event: Event) => {
      const target = event.target as Element | null;
      const sticky = target?.closest?.('[data-sticky-item-id]');
      if (sticky) {
        setHovered({ id: sticky.getAttribute('data-sticky-item-id')!, sticky: true });
        return;
      }
      const row = target?.closest?.('[data-item-id]');
      setHovered(row ? { id: row.getAttribute('data-item-id')!, sticky: false } : null);
    };
    const onLeave = () => setHovered(null);
    wrapper.addEventListener('mouseover', onOver, { passive: true });
    wrapper.addEventListener('mouseleave', onLeave);
    return () => {
      wrapper.removeEventListener('mouseover', onOver);
      wrapper.removeEventListener('mouseleave', onLeave);
    };
  }, [api, refId, redrawIndentLines]);

  // Scroll a row into view arithmetically: virtualized rows may not exist in the DOM, and the
  // sticky rows cover the top of the viewport, so the target lands below the stack it would
  // produce (its own ancestors).
  const scrollRowIntoView = useCallback((itemId: string, block: ScrollLogicalPosition): boolean => {
    const scroller = containerRef.current;
    if (!scroller) {
      return false;
    }
    const { offsets, indexById } = rowsRef.current;
    const index = indexById.get(itemId);
    if (index === undefined) {
      return false;
    }
    const offset = offsets[index];
    // The sticky rows cover `stack` px at the top. The floating sidebar-bottom widget covers
    // `bottomInset` px at the bottom, reserved as the scroller's padding-bottom. A row is fully
    // visible only between them.
    const stack = getAncestorIds(hoistedDataRef.current, itemId).length * TREE_ROW_HEIGHT;
    const bottomInset = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
    if (block === 'center') {
      const half = Math.max((scroller.clientHeight - bottomInset - TREE_ROW_HEIGHT) / 2, stack);
      scroller.scrollTop = offset - half;
      return true;
    }
    const viewTop = scroller.scrollTop + stack;
    const viewBottom = scroller.scrollTop + scroller.clientHeight - bottomInset - TREE_ROW_HEIGHT;
    if (offset < viewTop) {
      scroller.scrollTop = offset - stack;
    } else if (offset > viewBottom) {
      // Reveal the row just above the widget, rather than jumping it to the top.
      scroller.scrollTop = offset + TREE_ROW_HEIGHT + bottomInset - scroller.clientHeight;
    }
    return true;
  }, []);

  // Keep the keyboard-focused row clear of the sticky rows and of the floating bottom widget.
  // React-aria scrolls a focused row inside the raw viewport only, so a row behind either overlay
  // counts as visible and no scroll happens. The user then has to keep pressing until focus clears
  // the stack. A pointer click must not jump-scroll the row it lands on, so this runs for keyboard
  // navigation only.
  useEffect(() => {
    if (focusedItemId && lastInputModalityRef.current === 'keyboard') {
      scrollRowIntoView(focusedItemId, 'nearest');
    }
  }, [focusedItemId, scrollRowIntoView]);

  // Open the context menu for the right row when the global shortcut fires. Prefer the focused
  // row, and fall back to the selected story when focus is outside the tree.
  useEffect(() => {
    let frame: number | null = null;
    const handler = () => {
      // Every tree receives the event, one per composed ref. Fall back to the selected story of
      // this tree only when no row anywhere holds DOM focus. Otherwise the tree that owns the
      // focused row and the tree that owns the selection would both open a menu.
      const focusInAnyTree = !!document.activeElement?.closest('[data-item-id]');
      const itemId =
        focusedItemIdRef.current ?? (focusInAnyTree ? null : selectedStoryIdRef.current);
      if (!itemId) {
        return;
      }
      // The popover anchors to the ⋯ button of the row and takes its position once, when it
      // opens. A row outside the viewport is therefore scrolled into view first, because a
      // virtualized row mounts only near the viewport, and the menu opens on the next frame.
      const scroller = containerRef.current;
      const row = scroller?.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`);
      const rowRect = row?.getBoundingClientRect();
      const scrollerRect = scroller?.getBoundingClientRect();
      if (
        rowRect &&
        scrollerRect &&
        rowRect.top >= scrollerRect.top &&
        rowRect.bottom <= scrollerRect.bottom
      ) {
        openContextMenu(itemId, 'keyboard');
        return;
      }
      scrollRowIntoView(itemId, 'center');
      frame = requestAnimationFrame(() => {
        frame = null;
        openContextMenu(itemId, 'keyboard');
      });
    };
    api.on(SIDEBAR_OPEN_CONTEXT_MENU, handler);
    return () => {
      api.off(SIDEBAR_OPEN_CONTEXT_MENU, handler);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [api, openContextMenu, scrollRowIntoView]);

  // Scroll the selected story into view when it changes. A newly selected row may not be in the
  // DOM yet, because its ancestors expand in the same commit but render on the next one. The
  // effect therefore retries on every expansion change, and stops once the row exists.
  const lastScrolledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedStoryId || lastScrolledIdRef.current === selectedStoryId) {
      return;
    }
    if (scrollRowIntoView(selectedStoryId, 'nearest')) {
      lastScrolledIdRef.current = selectedStoryId;
    }
  }, [selectedStoryId, expanded, scrollRowIntoView]);

  // Center the selected story once, when the tree mounts with a selection already made (a deep
  // link). A selection that arrives after a selection-less mount is a click on a visible row,
  // where a center scroll would pull the row out from under the pointer.
  const needsInitialCenterRef = useRef(selectedStoryId != null);
  useEffect(() => {
    if (!needsInitialCenterRef.current || !selectedStoryId) {
      return;
    }
    if (scrollRowIntoView(selectedStoryId, 'center')) {
      needsInitialCenterRef.current = false;
      lastScrolledIdRef.current = selectedStoryId;
    }
  }, [selectedStoryId, expanded, scrollRowIntoView]);

  // One dependencies array shared by every Collection level, so react-aria's cached nodes are
  // invalidated consistently — a drifted copy at one level renders stale rows. Deliberately
  // minimal: invalidating the collection re-renders every row in the tree, which takes seconds
  // on fully-expanded trees. The open context menu reaches rows through ContextMenuStore
  // instead, and the statuses through StatusContext. hasTestProviders is baked into cached row
  // elements, so it must invalidate them when a provider registers.
  const collectionDependencies = useMemo(
    () => [expanded, hasTestProviders],
    [expanded, hasTestProviders]
  );

  // Memoize renderNode's returned closure so Collection receives a stable children prop
  // as long as the relevant inputs are stable.
  const nodeRenderer = useMemo(
    () =>
      renderNode({
        api,
        refId,
        onSelectStoryId,
        expanded,
        sectionStartIds: rows.sectionStartIds,
        labelContext,
        openContextMenu,
        closeContextMenu,
        hasTestProviders,
        collectionDependencies,
      }),
    [
      api,
      refId,
      onSelectStoryId,
      expanded,
      rows.sectionStartIds,
      labelContext,
      openContextMenu,
      closeContextMenu,
      hasTestProviders,
      collectionDependencies,
    ]
  );

  // Rows are fixed-height except section starts, which carry the gap as padding; the layout
  // measures rendered rows against this estimate.
  const treeLayout = useMemo(() => new ListLayout({ estimatedRowHeight: TREE_ROW_HEIGHT }), []);

  // Memoized so unrelated Tree re-renders (focus tracking, context-menu state) don't re-render
  // every TreeNode through the context.
  const statusContextValue = useMemo(
    () => ({ groupDualStatus, isModifiedFilterActive }),
    [groupDualStatus, isModifiedFilterActive]
  );

  const collapseStickyRow = useCallback(
    (itemId: string) => setExpanded({ ids: [itemId], append: true, value: false }),
    [setExpanded]
  );

  return (
    <StatusContext.Provider value={statusContextValue}>
      <ContextMenuStoreContext.Provider value={contextMenuStoreRef.current}>
        <TreeWrapper ref={treeWrapperRef}>
          <Virtualizer layout={treeLayout}>
            <StyledAriaTree
              ref={containerRef}
              aria-label="Stories"
              selectionMode="single"
              // With the default 'toggle' behavior react-aria treats Enter as a no-op while a
              // selection exists; 'replace' keeps Enter firing onAction on every row.
              selectionBehavior="replace"
              expandedKeys={expanded}
              onExpandedChange={handleExpandedChange}
              selectedKeys={selectedKeys}
              onSelectionChange={handleSelectionChange}
              onAction={handleAction}
            >
              <Collection items={tree} dependencies={collectionDependencies}>
                {nodeRenderer}
              </Collection>
            </StyledAriaTree>
          </Virtualizer>
          <TreeStickyRows
            ids={stickyIds}
            data={hoistedData}
            api={api}
            labelContext={labelContext}
            scrollerRef={containerRef}
            rowsRef={rowsRef}
            onCollapse={collapseStickyRow}
          />
          {indentLines}
        </TreeWrapper>
        {focusedItemShortcutLabel && (
          <FocusTooltipNote note={focusedItemShortcutLabel} shortcut={contextMenuShortcut} />
        )}
      </ContextMenuStoreContext.Provider>
    </StatusContext.Provider>
  );
});

// Stable module-level constant so empty-state props don't bust React.memo equality checks.
const EMPTY_KEYS: Set<string> = new Set();

function shallowEqualRecords(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
}

/** Reuse the previous object identity while its entries are shallow-equal (same value refs). */
function useStableIdentity<T extends Record<string, any> | undefined>(value: T): T {
  const ref = useRef(value);
  if (ref.current !== value && !shallowEqualRecords(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

interface RenderNodeProps extends Pick<
  TreeNodeProps,
  'api' | 'refId' | 'onSelectStoryId' | 'labelContext'
> {
  expanded: Set<string>;
  /** Section-start rows that carry the inter-section gap as padding. */
  sectionStartIds: Set<string>;
  openContextMenu: NonNullable<TreeNodeProps['openContextMenu']>;
  closeContextMenu: NonNullable<TreeNodeProps['closeContextMenu']>;
  hasTestProviders: boolean;
  /** Shared with every Collection level so react-aria invalidates its node cache consistently. */
  collectionDependencies: unknown[];
}

function renderNode({
  expanded,
  sectionStartIds,
  openContextMenu,
  closeContextMenu,
  hasTestProviders,
  collectionDependencies,
  ...props
}: RenderNodeProps) {
  const renderNodeLevel = (item: TreeEntry) => {
    return (
      <TreeNode
        {...props}
        key={item.id}
        item={item}
        isExpanded={expanded.has(item.id)}
        startsSection={sectionStartIds.has(item.id)}
        openContextMenu={openContextMenu}
        closeContextMenu={closeContextMenu}
        hasTestProviders={hasTestProviders}
      >
        {item.resolvedChildren && (
          <Collection items={item.resolvedChildren} dependencies={collectionDependencies}>
            {renderNodeLevel}
          </Collection>
        )}
      </TreeNode>
    );
  };
  return renderNodeLevel;
}
