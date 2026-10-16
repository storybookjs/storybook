/// <reference path="./typings.d.ts" />
/* eslint-env browser */
import type { Channel } from 'storybook/internal/channels';

import { HIGHLIGHT_MENU, HIGHLIGHT_MENU_INTERACTION, MAX_Z_INDEX } from './constants.ts';
import type { HighlightMenuInteraction, HighlightMenuState } from './types.ts';
import {
  clampToRect,
  createElement,
  createIcon,
  hidePopover,
  previewToManagerCoords,
  showPopover,
} from './utils.ts';

const menuId = 'storybook-highlights-menu';
const rootId = 'storybook-highlights-root';

const menuStyles = `
  #${menuId} {
    position: fixed;
    z-index: ${MAX_Z_INDEX};
    width: 300px;
    padding: 0px;
    margin: 15px 0 0 0;
    transform: translateX(-50%);
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
    max-height: 300px;
    overflow-y: auto;
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
 * element it belongs to. The preview sends the menu state (targets, selection and anchor
 * coordinates in preview viewport space) over the channel; this module keeps the menu
 * synchronized with the preview while it is open, and forwards user interactions back to the
 * preview. Rendering the menu here (rather than inside the preview) prevents a malicious site
 * from triggering it by embedding the preview iframe.
 *
 * Returns a teardown function which is only meant for tests.
 */
export const useHighlightMenu = (channel: Channel) => {
  if (globalThis.__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED) {
    return () => {};
  }

  globalThis.__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED = true;

  let state: HighlightMenuState | undefined;
  let refId: string | undefined;
  let root: HTMLElement | undefined;
  let menu: HTMLElement | undefined;
  let animationFrame: number | undefined;

  const getPreviewIframe = () =>
    (refId
      ? document.getElementById(`storybook-ref-${refId}`)
      : document.getElementById('storybook-preview-iframe')) as HTMLIFrameElement | null;

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
      : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

    const { x, y } = clampToRect(
      anchor,
      { width: menu.clientWidth, height: menu.clientHeight },
      viewport,
      { topOffset: 15, centered: true }
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
    stopSync();
    if (menu) {
      hidePopover(menu);
      Object.assign(menu.style, { display: 'none' });
    }
  };

  const ensureMenu = () => {
    if (!menu) {
      root =
        document.getElementById(rootId) ??
        (document.body.appendChild(
          createElement('div', { id: rootId }) as HTMLElement
        ) as HTMLElement);
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
            const selectable =
              elementList.length > 1 &&
              !!target.menu?.some((group) =>
                group.some(
                  (item) =>
                    !item.selectors ||
                    item.selectors.some((s) => target.details.selectors.includes(s))
                )
              );
            const props = selectable
              ? {
                  class: 'selectable',
                  onClick: () =>
                    channel.emit(HIGHLIGHT_MENU_INTERACTION, {
                      action: 'select',
                      index,
                    } satisfies HighlightMenuInteraction),
                  onMouseEnter: () =>
                    channel.emit(HIGHLIGHT_MENU_INTERACTION, {
                      action: 'focus',
                      index,
                    } satisfies HighlightMenuInteraction),
                  onMouseLeave: () =>
                    channel.emit(HIGHLIGHT_MENU_INTERACTION, {
                      action: 'blur',
                    } satisfies HighlightMenuInteraction),
                }
              : selectedTarget
                ? {
                    class: 'selected',
                    onClick: () =>
                      channel.emit(HIGHLIGHT_MENU_INTERACTION, {
                        action: 'deselect',
                      } satisfies HighlightMenuInteraction),
                  }
                : {};
            const asButton = selectable || !!selectedTarget;
            return createElement('li', props, [
              createElement(asButton ? 'button' : 'div', asButton ? { type: 'button' } : {}, [
                selectedTarget ? createIcon('chevronLeft') : null,
                createElement('code', {}, [target.details.element.outerHTML]),
                selectable ? createIcon('chevronRight') : null,
              ]),
            ]);
          })
        )
      );
    }

    const menuTarget = selectedTarget ?? (targets.length === 1 ? targets[0] : undefined);
    if (menuTarget) {
      const menuGroups = menuTarget.menu?.filter((group) =>
        group.some(
          (item) =>
            !item.selectors || item.selectors.some((s) => menuTarget.details.selectors.includes(s))
        )
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
                  menuItems.map(({ id, title, description, iconLeft, iconRight, clickEvent }) => {
                    const onClick =
                      clickEvent && (() => channel.emit(clickEvent, id, menuTarget.details));
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

  const onMenuState = function (this: { refId?: string }, payload: HighlightMenuState) {
    if (!payload || !Array.isArray(payload.targets) || !payload.targets.length || !payload.coords) {
      hideMenu();
      return;
    }

    refId = this.refId;
    state = payload;

    const menuElement = ensureMenu();
    renderMenu(menuElement, payload);
    Object.assign(menuElement.style, { display: 'block' });
    showMenu(menuElement);
    positionMenu();
    startSync();
  };

  channel.on(HIGHLIGHT_MENU, onMenuState);

  return () => {
    channel.off(HIGHLIGHT_MENU, onMenuState);
    hideMenu();
    menu?.remove();
    root?.remove();
    menu = undefined;
    root = undefined;
    state = undefined;
    refId = undefined;
  };
};
