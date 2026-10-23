/// <reference path="./typings.d.ts" />
/* eslint-env browser */
import type { Channel } from 'storybook/internal/channels';
import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import {
  HIGHLIGHT,
  HIGHLIGHT_MENU,
  HIGHLIGHT_MENU_CLICK,
  HIGHLIGHT_MENU_INTERACTION,
  MAX_Z_INDEX,
  REMOVE_HIGHLIGHT,
  RESET_HIGHLIGHT,
} from './constants.ts';
import type {
  Highlight,
  HighlightMenuInteraction,
  HighlightMenuState,
  HighlightOptions,
} from './types.ts';
import {
  clampToRect,
  createElement,
  createIcon,
  filterMenuGroups,
  hidePopover,
  normalizeOptions,
  previewToManagerCoords,
  showPopover,
} from './utils.ts';

const menuId = 'storybook-highlights-menu';
const rootId = 'storybook-highlights-root';
const MENU_MARGIN = 5;
const MENU_TOP_OFFSET = 15;
const MENU_MAX_HEIGHT = 300;

const menuStyles = `
  #${menuId} {
    position: fixed;
    z-index: ${MAX_Z_INDEX};
    width: 300px;
    max-height: ${MENU_MAX_HEIGHT}px;
    padding: 0px;
    margin: 15px 0 0 0;
    transform: translateX(-50%);
    overflow-y: auto;
    font-family: "Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 12px;
    background: white;
    border: none;
    border-radius: 6px;
    box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.05), 0 5px 15px 0 rgba(0, 0, 0, 0.1);
    color: #2E3438;
  }
  #${menuId} ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  #${menuId} > ul {
    padding: 4px 0;
  }
  #${menuId} li {
    padding: 0 4px;
    margin: 0;
  }
  #${menuId} li > :not(ul) {
    display: flex;
    padding: 8px;
    margin: 0;
    align-items: center;
    gap: 8px;
    border-radius: 4px;
  }
  #${menuId} button {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
  }
  #${menuId} button:focus-visible {
    outline-color: #029CFD;
  }
  #${menuId} button:hover {
    background: rgba(2, 156, 253, 0.07);
    color: #029CFD;
    cursor: pointer;
  }
  #${menuId} li code {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 16px;
    font-size: 11px;
  }
  #${menuId} li svg {
    flex-shrink: 0;
    margin: 1px;
    color: #73828C;
  }
  #${menuId} li > button:hover svg, #${menuId} li > button:focus-visible svg {
    color: #029CFD;
  }
  #${menuId} .element-list li svg {
    display: none;
  }
  #${menuId} li.selectable svg, #${menuId} li.selected svg {
    display: block;
  }
  #${menuId} .menu-list {
    border-top: 1px solid rgba(38, 85, 115, 0.15);
  }
  #${menuId} .menu-list > li:not(:last-child) {
    padding-bottom: 4px;
    margin-bottom: 4px;
    border-bottom: 1px solid rgba(38, 85, 115, 0.15);
  }
  #${menuId} .menu-items, #${menuId} .menu-items li {
    padding: 0;
  }
  #${menuId} .menu-item {
    display: flex;
  }
  #${menuId} .menu-item-content {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
`;

const showMenu = (menu: HTMLElement) => {
  try {
    showPopover(menu);
  } catch {
    // The menu is already in the top layer; re-showing an open popover throws.
  }
};

/**
 * Renders the interactive highlight menu in the manager, positioned over the preview iframe
 * element it belongs to. The preview reports which highlight targets were hit and where; the menu
 * itself is rendered here from a manager-side registry of the `HighlightOptions` payloads the
 * preview announced over the channel, so a malicious site embedding the preview iframe can never
 * inject menu content or trigger the menu (see GHSA-f2ph-cmg5-wxc8). User interactions are
 * forwarded back to the preview frame the menu belongs to.
 *
 * Returns a teardown function which is only meant for tests.
 */
export const useHighlightMenu = (channel: Channel) => {
  if (globalThis.__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED) {
    return () => {};
  }

  globalThis.__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED = true;

  let state: HighlightMenuState | undefined;
  let renderedKey: string | undefined;
  let refId: string | undefined;
  let root: HTMLElement | undefined;
  let createdRoot = false;
  let menu: HTMLElement | undefined;
  let animationFrame: number | undefined;

  // Menu definitions are rendered from this manager-side registry, populated from the `Highlight`
  // payloads announced over the channel. The preview only reports which highlight id was hit; the
  // manager never renders menu content received through the menu state event. Entries are bucketed
  // by origin: every ref has its own bucket keyed by its ref id, the host preview's registrations
  // live in the host bucket, and manager-local registrations (e.g. from manager addons) live in a
  // bucket of their own, so identical highlight ids never overwrite each other across origins.
  const highlightRegistry = new Map<string | symbol, Map<string, Highlight>>();
  /** Registry bucket for highlights announced by the host preview. */
  const HOST_REGISTRY_KEY = '';
  /** Registry bucket for manager-local registrations, which apply to every frame. */
  const MANAGER_REGISTRY_KEY = Symbol('manager-registry');

  const findHighlight = (id: string, frameId?: string) =>
    (frameId
      ? highlightRegistry.get(frameId)?.get(id)
      : highlightRegistry.get(HOST_REGISTRY_KEY)?.get(id)) ??
    highlightRegistry.get(MANAGER_REGISTRY_KEY)?.get(id);

  /** The registry bucket an incoming registration belongs to. */
  const getRegistryKey = function (this: { refId?: string; source?: string }) {
    // Events from a preview carry the source its channel transport stamped on them; a ref's
    // events additionally carry its ref id. Manager-local emits carry neither.
    if (this.refId) {
      return this.refId;
    }
    return this.source ? HOST_REGISTRY_KEY : MANAGER_REGISTRY_KEY;
  };

  const getContentKey = ({ targets, selected }: HighlightMenuState) =>
    JSON.stringify({
      targets: targets.map(({ id, label, details: { selectors, element } }) => ({
        id,
        label,
        selectors,
        element,
      })),
      selected,
      refId,
      // The rendered menu also depends on the registry entries resolved for these targets, so
      // registry updates that do not affect them must not rebuild the open menu.
      menus: targets.map(({ id, details }) =>
        filterMenuGroups(findHighlight(id, refId)?.menu, details.selectors)
      ),
    });

  const getPreviewIframe = () =>
    (refId
      ? document.getElementById(`storybook-ref-${refId}`)
      : document.getElementById('storybook-preview-iframe')) as HTMLIFrameElement | null;

  /** Emit an interaction, routed back to the preview frame the menu is anchored to. */
  const emitInteraction = (interaction: HighlightMenuInteraction) =>
    channel.emit(HIGHLIGHT_MENU_INTERACTION, {
      ...interaction,
      options: {
        target: refId ? `storybook-ref-${refId}` : 'storybook-preview-iframe',
      },
    });

  const positionMenu = () => {
    if (!menu || !state?.coords) {
      return;
    }

    const iframe = getPreviewIframe();
    const anchor = iframe
      ? previewToManagerCoords(state.coords, iframe.getBoundingClientRect(), {
          width: iframe.clientWidth,
          height: iframe.clientHeight,
        })
      : // Without an iframe (e.g. in tests) the preview coordinates map directly onto this document
        state.coords;
    const viewport = iframe
      ? iframe.getBoundingClientRect()
      : {
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
          height: window.innerHeight,
        };

    // Cap the menu at its natural height and at the space available over the preview, so it can
    // be clamped inside even when the preview is shorter than the menu; `overflow-y: auto` then
    // keeps its buttons reachable by scrolling.
    menu.style.maxHeight = `${Math.min(
      MENU_MAX_HEIGHT,
      Math.max(0, viewport.height - MENU_MARGIN * 2 - MENU_TOP_OFFSET)
    )}px`;

    const { x, y } = clampToRect(
      anchor,
      { width: menu.clientWidth, height: menu.clientHeight },
      viewport,
      { margin: MENU_MARGIN, topOffset: MENU_TOP_OFFSET, centered: true }
    );
    Object.assign(menu.style, { left: `${x}px`, top: `${y}px` });
  };

  // The iframe can move or resize without the preview knowing (e.g. sidebar, panel, zoom or
  // window changes), and CSS transforms do not trigger a ResizeObserver, so reposition on every
  // frame while the menu is open.
  const startSync = () => {
    if (animationFrame === undefined) {
      const tick = () => {
        positionMenu();
        animationFrame = requestAnimationFrame(tick);
      };
      animationFrame = requestAnimationFrame(tick);
    }
  };

  const stopSync = () => {
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
  };

  const hideMenu = () => {
    state = undefined;
    renderedKey = undefined;
    stopSync();
    if (menu) {
      hidePopover(menu);
      Object.assign(menu.style, { display: 'none' });
    }
  };

  const ensureMenu = () => {
    if (!menu) {
      const existing = document.getElementById(rootId);
      root = existing ?? (createElement('div', { id: rootId }) as HTMLElement);
      createdRoot = !existing;
      if (!existing) {
        document.body.appendChild(root);
      }
      root.appendChild(createElement('style', {}, [menuStyles]));
      menu = root.appendChild(
        createElement('div', { id: menuId, popover: 'manual' }) as HTMLElement
      );
    }
    return menu;
  };

  const renderMenu = (menuElement: HTMLElement, { targets, selected }: HighlightMenuState) => {
    menuElement.innerHTML = '';

    const selectedTarget = typeof selected === 'number' ? targets[selected] : undefined;
    const elementList = selectedTarget
      ? [{ target: selectedTarget, index: selected as number }]
      : targets.map((target, index) => ({ target, index }));

    if (elementList.length) {
      menuElement.appendChild(
        createElement(
          'ul',
          { class: 'element-list' },
          elementList.map(({ target, index }) => {
            const menuGroups = filterMenuGroups(
              findHighlight(target.id, refId)?.menu,
              target.details.selectors
            );
            const selectable = elementList.length > 1 && !!menuGroups?.length;
            const props = selectable
              ? {
                  class: 'selectable',
                  onClick: () => emitInteraction({ action: 'select', index }),
                  onMouseEnter: () => emitInteraction({ action: 'focus', index }),
                  onMouseLeave: () => emitInteraction({ action: 'blur' }),
                }
              : selectedTarget
                ? {
                    class: 'selected',
                    onClick: () => emitInteraction({ action: 'deselect' }),
                  }
                : {};
            const asButton = selectable || !!selectedTarget;
            return createElement('li', props, [
              createElement(asButton ? 'button' : 'div', asButton ? { type: 'button' } : {}, [
                selectedTarget ? createIcon('chevronLeft') : null,
                createElement('code', {}, [target.label]),
                selectable ? createIcon('chevronRight') : null,
              ]),
            ]);
          })
        )
      );
    }

    const menuTarget = selectedTarget ?? (targets.length === 1 ? targets[0] : undefined);
    if (menuTarget) {
      const menuGroups = filterMenuGroups(
        findHighlight(menuTarget.id, refId)?.menu,
        menuTarget.details.selectors
      );
      if (menuGroups?.length) {
        menuElement.appendChild(
          createElement(
            'ul',
            { class: 'menu-list' },
            menuGroups.map((menuItems) =>
              createElement('li', {}, [
                createElement(
                  'ul',
                  { class: 'menu-items' },
                  menuItems.map(({ id, title, description, iconLeft, iconRight, clickable }) => {
                    const onClick =
                      clickable &&
                      (() =>
                        channel.emit(HIGHLIGHT_MENU_CLICK, menuTarget.id, id, menuTarget.details));
                    return createElement('li', {}, [
                      createElement(
                        onClick ? 'button' : 'div',
                        onClick
                          ? { class: 'menu-item', type: 'button', onClick }
                          : { class: 'menu-item' },
                        [
                          iconLeft ? createIcon(iconLeft) : null,
                          createElement('div', { class: 'menu-item-content' }, [
                            createElement(description ? 'strong' : 'span', {}, [title]),
                            description && createElement('span', {}, [description]),
                          ]),
                          iconRight ? createIcon(iconRight) : null,
                        ]
                      ),
                    ]);
                  })
                ),
              ])
            )
          )
        );
      }
    }
  };

  const onHighlightRegistryChange = () => {
    if (!state || !menu) {
      renderedKey = undefined;
      return;
    }
    // Re-render an open menu right away when the registry change affects the content it renders,
    // so updates are not masked by the content key until the targets or the selection change.
    // Changes for other highlight ids or frames leave the menu alone, so keyboard focus on a menu
    // item and the list's scroll position survive them.
    const contentKey = getContentKey(state);
    if (contentKey === renderedKey) {
      return;
    }
    renderedKey = contentKey;
    renderMenu(menu, state);
    positionMenu();
  };

  const onAddHighlight = function (
    this: { refId?: string; source?: string },
    highlight: HighlightOptions
  ) {
    const info = highlight && normalizeOptions(highlight);
    if (typeof info?.id !== 'string' || !info.id) {
      return;
    }
    const key = getRegistryKey.call(this);
    let registry = highlightRegistry.get(key);
    if (!registry) {
      registry = new Map();
      highlightRegistry.set(key, registry);
    }
    registry.set(info.id, info);
    onHighlightRegistryChange();
  };

  const onRemoveHighlight = function (this: { refId?: string; source?: string }, id: string) {
    if (id) {
      highlightRegistry.get(getRegistryKey.call(this))?.delete(id);
      onHighlightRegistryChange();
    }
  };

  const onResetHighlights = function (this: { refId?: string; source?: string }) {
    if (this.refId) {
      // A ref-sourced reset only clears that ref's entries.
      highlightRegistry.delete(this.refId);
    } else if (this.source) {
      // A host-preview reset only clears the host preview's own entries, never a ref's or the
      // manager's.
      highlightRegistry.delete(HOST_REGISTRY_KEY);
    } else {
      // Every preview listens for a manager-local reset and resets itself, so it clears all frames.
      highlightRegistry.clear();
    }
    onHighlightRegistryChange();
  };

  // The preview resets its highlights when a story starts rendering; clear the registry of the
  // frame that re-rendered so ids from previous stories do not accumulate for the whole session.
  const onStoryRenderPhaseChanged = function (
    this: { refId?: string },
    { newPhase }: { newPhase: string }
  ) {
    if (newPhase === 'loading') {
      highlightRegistry.delete(this.refId ?? HOST_REGISTRY_KEY);
      onHighlightRegistryChange();
    }
  };

  channel.on(HIGHLIGHT, onAddHighlight);
  channel.on(REMOVE_HIGHLIGHT, onRemoveHighlight);
  channel.on(RESET_HIGHLIGHT, onResetHighlights);
  channel.on(STORY_RENDER_PHASE_CHANGED, onStoryRenderPhaseChanged);

  const onMenuState = function (this: { refId?: string }, payload: HighlightMenuState) {
    if (!payload || !Array.isArray(payload.targets) || !payload.targets.length || !payload.coords) {
      hideMenu();
      return;
    }

    refId = this.refId;
    state = payload;

    const menuElement = ensureMenu();

    // Position-only updates (preview scrolling, resizing and layout changes) re-send the same
    // targets and selection with new coordinates or box geometry. Only rebuild the menu when the
    // content it renders actually changes, so keyboard focus and its scroll position survive
    // those updates.
    const contentKey = getContentKey(payload);
    if (contentKey !== renderedKey) {
      renderedKey = contentKey;
      renderMenu(menuElement, payload);
    }

    Object.assign(menuElement.style, { display: 'block' });
    showMenu(menuElement);
    positionMenu();
    startSync();
  };

  channel.on(HIGHLIGHT_MENU, onMenuState);

  return () => {
    channel.off(HIGHLIGHT_MENU, onMenuState);
    channel.off(HIGHLIGHT, onAddHighlight);
    channel.off(REMOVE_HIGHLIGHT, onRemoveHighlight);
    channel.off(RESET_HIGHLIGHT, onResetHighlights);
    channel.off(STORY_RENDER_PHASE_CHANGED, onStoryRenderPhaseChanged);
    highlightRegistry.clear();
    hideMenu();
    menu?.remove();
    // In tests running the preview and manager in one document, the root also hosts the
    // preview's highlight boxes, so only remove it when this module created it.
    if (createdRoot) {
      root?.remove();
    }
    menu = undefined;
    root = undefined;
    createdRoot = false;
    state = undefined;
    refId = undefined;
    renderedKey = undefined;
    globalThis.__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED = false;
  };
};
