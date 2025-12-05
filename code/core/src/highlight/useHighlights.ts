/// <reference path="./typings.d.ts" />
/* eslint-env browser */
import type { Channel } from 'storybook/internal/channels';
import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import {
  HIGHLIGHT,
  MAX_Z_INDEX,
  MIN_TOUCH_AREA_SIZE,
  REMOVE_HIGHLIGHT,
  RESET_HIGHLIGHT,
  SCROLL_INTO_VIEW,
} from './constants';
import type { Box, Highlight, HighlightOptions, RawHighlightOptions } from './types';
import {
  createElement,
  createIcon,
  getEventDetails,
  hidePopover,
  isOverMenu,
  isTargeted,
  keepInViewport,
  mapBoxes,
  mapElements,
  normalizeOptions,
  showPopover,
  useStore,
} from './utils';

const menuId = 'storybook-highlights-menu';
const rootId = 'storybook-highlights-root';
const storybookRootId = 'storybook-root';

export const useHighlights = (channel: Channel) => {
  if (globalThis.__STORYBOOK_HIGHLIGHT_INITIALIZED) {
    return;
  }

  globalThis.__STORYBOOK_HIGHLIGHT_INITIALIZED = true;

  const { document } = globalThis;

  const highlights = useStore<HighlightOptions[]>([]);
  const elements = useStore<Map<HTMLElement, Highlight>>(new Map());
  const boxes = useStore<Box[]>([]);

  const clickCoords = useStore<{ x: number; y: number } | undefined>();
  const hoverCoords = useStore<{ x: number; y: number } | undefined>();
  const targets = useStore<Box[]>([]);
  const hovered = useStore<Box[]>([]);
  const focused = useStore<Box | undefined>();
  const selected = useStore<Box | undefined>();

  let root = document.getElementById(rootId);

  // Only create the root element when first highlights are added
  highlights.subscribe(() => {
    if (!root) {
      root = createElement('div', { id: rootId }) as HTMLElement;
      document.body.appendChild(root);
    }
  });

  // Update tracked elements when highlights change or the DOM tree changes
  highlights.subscribe((value) => {
    const storybookRoot = document.getElementById(storybookRootId)!;
    if (!storybookRoot) {
      return;
    }

    elements.set(mapElements(value));

    const observer = new MutationObserver(() => elements.set(mapElements(value)));
    observer.observe(storybookRoot, { subtree: true, childList: true });

    return () => {
      observer.disconnect();
    };
  });

  // Update highlight boxes when elements are resized or scrollable elements are scrolled
  elements.subscribe((value) => {
    const updateBoxes = () => requestAnimationFrame(() => boxes.set(mapBoxes(value)));
    const observer = new ResizeObserver(updateBoxes);
    observer.observe(document.body);
    Array.from(value.keys()).forEach((element) => observer.observe(element));

    const scrollers = Array.from(document.body.querySelectorAll('*')).filter((el) => {
      const { overflow, overflowX, overflowY } = window.getComputedStyle(el);
      return ['auto', 'scroll'].some((o) => [overflow, overflowX, overflowY].includes(o));
    });
    scrollers.forEach((element) => element.addEventListener('scroll', updateBoxes));

    return () => {
      observer.disconnect();
      scrollers.forEach((element) => element.removeEventListener('scroll', updateBoxes));
    };
  });

  // Update highlight boxes for sticky elements when scrolling the window
  elements.subscribe((value) => {
    const sticky = Array.from(value.keys()).filter(({ style }) => style.position === 'sticky');
    const updateBoxes = () =>
      requestAnimationFrame(() => {
        boxes.set((current) =>
          current.map((box) => {
            if (sticky.includes(box.element)) {
              const { top, left } = box.element.getBoundingClientRect();
              return { ...box, top: top + window.scrollY, left: left + window.scrollX };
            }
            return box;
          })
        );
      });

    document.addEventListener('scroll', updateBoxes);
    return () => document.removeEventListener('scroll', updateBoxes);
  });

  // Remove stale click targets (boxes) when elements are removed
  elements.subscribe((value) => {
    targets.set((t) => t.filter(({ element }) => value.has(element)));
  });

  // Update selected and focused elements when clickable targets change
  targets.subscribe((value) => {
    if (value.length) {
      selected.set((s) => (value.some((t) => t.element === s?.element) ? s : undefined));
      focused.set((s) => (value.some((t) => t.element === s?.element) ? s : undefined));
    } else {
      selected.set(undefined);
      focused.set(undefined);
      clickCoords.set(undefined);
    }
  });

  //
  // Rendering
  //

  const styleElementByHighlight = new Map<string, HTMLStyleElement>(new Map());

  // Update highlight keyframes when highlights change
  highlights.subscribe((value) => {
    value.forEach(({ keyframes }) => {
      if (keyframes) {
        let style = styleElementByHighlight.get(keyframes);
        if (!style) {
          style = document.createElement('style');
          style.setAttribute('data-highlight', 'keyframes');
          styleElementByHighlight.set(keyframes, style);
          document.head.appendChild(style);
        }
        style.innerHTML = keyframes;
      }
    });

    // Clean up stale keyframes
    styleElementByHighlight.forEach((style, keyframes) => {
      if (!value.some((v) => v.keyframes === keyframes)) {
        style.remove();
        styleElementByHighlight.delete(keyframes);
      }
    });
  });

  const boxElementByTargetElement = new Map<HTMLElement, HTMLDivElement>(new Map());

  // Create an element for every highlight box
  boxes.subscribe((value) => {
    value.forEach((box) => {
      let boxElement = boxElementByTargetElement.get(box.element);
      if (root && !boxElement) {
        const props = {
          popover: 'manual',
          'data-highlight-dimensions': `w${box.width.toFixed(0)}h${box.height.toFixed(0)}`,
          'data-highlight-coordinates': `x${box.left.toFixed(0)}y${box.top.toFixed(0)}`,
        };
        boxElement = root.appendChild(
          createElement('div', props, [createElement('div')]) as HTMLDivElement
        );
        boxElementByTargetElement.set(box.element, boxElement);
      }
    });

    // Clean up stale highlight boxes
    boxElementByTargetElement.forEach((box, element) => {
      if (!value.some(({ element: e }) => e === element)) {
        box.remove();
        boxElementByTargetElement.delete(element);
      }
    });
  });

  // Handle click events on highlight boxes
  boxes.subscribe((value) => {
    const targetable = value.filter((box) => box.menu);
    if (!targetable.length) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      // The menu may get repositioned, so we wait for the next frame before checking its position
      requestAnimationFrame(() => {
        const menu = document.getElementById(menuId);
        const coords = { x: event.pageX, y: event.pageY };

        // Don't do anything if the click is within the menu
        if (menu && !isOverMenu(menu, coords)) {
          // Update menu coordinates and clicked target boxes based on the click position
          const results = targetable.filter((box) => {
            const boxElement = boxElementByTargetElement.get(box.element)!;
            return isTargeted(box, boxElement, coords);
          });
          clickCoords.set(results.length ? coords : undefined);
          targets.set(results);
        }
      });
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  });

  const updateHovered = () => {
    const menu = document.getElementById(menuId);
    const coords = hoverCoords.get();
    if (!coords || (menu && isOverMenu(menu, coords))) {
      return;
    }

    hovered.set((current) => {
      const update = boxes.get().filter((box) => {
        const boxElement = boxElementByTargetElement.get(box.element)!;
        return isTargeted(box, boxElement, coords);
      });
      const existing = current.filter((box) => update.includes(box));
      const additions = update.filter((box) => !current.includes(box));
      const hasRemovals = current.length - existing.length;
      // Only set a new value if there are additions or removals
      return additions.length || hasRemovals ? [...existing, ...additions] : current;
    });
  };
  hoverCoords.subscribe(updateHovered);
  boxes.subscribe(updateHovered);

  const updateBoxStyles = () => {
    const selectedElement = selected.get();
    const targetElements = selectedElement ? [selectedElement] : targets.get();
    const focusedElement = targetElements.length === 1 ? targetElements[0] : focused.get();
    const isMenuOpen = clickCoords.get() !== undefined;

    boxes.get().forEach((box) => {
      const boxElement = boxElementByTargetElement.get(box.element);
      if (boxElement) {
        const isFocused = focusedElement === box;
        const isHovered = isMenuOpen
          ? focusedElement
            ? isFocused
            : targetElements.includes(box)
          : hovered.get()?.includes(box);

        Object.assign(boxElement.style, {
          animation: 'none',
          background: 'transparent',
          border: 'none',
          boxSizing: 'border-box',
          outline: 'none',
          outlineOffset: '0px',
          ...box.styles,
          ...(isHovered ? box.hoverStyles : {}),
          ...(isFocused ? box.focusStyles : {}),
          position: getComputedStyle(box.element).position === 'fixed' ? 'fixed' : 'absolute',
          zIndex: MAX_Z_INDEX - 10,
          top: `${box.top}px`,
          left: `${box.left}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          margin: 0,
          padding: 0,
          cursor: box.menu && isHovered ? 'pointer' : 'default',
          pointerEvents: box.menu ? 'auto' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        });
        Object.assign((boxElement.children[0] as HTMLDivElement).style, {
          width: '100%',
          height: '100%',
          minHeight: `${MIN_TOUCH_AREA_SIZE}px`,
          minWidth: `${MIN_TOUCH_AREA_SIZE}px`,
          boxSizing: 'content-box',
          padding: boxElement.style.outlineWidth || '0px',
        });

        showPopover(boxElement);
      }
    });
  };
  boxes.subscribe(updateBoxStyles);
  targets.subscribe(updateBoxStyles);
  hovered.subscribe(updateBoxStyles);
  focused.subscribe(updateBoxStyles);
  selected.subscribe(updateBoxStyles);

  const renderMenu = () => {
    if (!root) {
      return;
    }

    let menu = document.getElementById(menuId);
    if (menu) {
      menu.innerHTML = '';
    } else {
      const props = { id: menuId, popover: 'manual' };
      menu = root.appendChild(createElement('div', props) as HTMLElement);
      root.appendChild(
        createElement('style', {}, [
          `
            #${menuId} {
              position: absolute;
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
          `,
        ])
      );
    }

    const selectedElement = selected.get();
    const elementList = selectedElement ? [selectedElement] : targets.get();

    if (elementList.length) {
      menu.style.position =
        getComputedStyle(elementList[0].element).position === 'fixed' ? 'fixed' : 'absolute';

      menu.appendChild(
        createElement(
          'ul',
          { class: 'element-list' },
          elementList.map((target) => {
            const selectable =
              elementList.length > 1 &&
              !!target.menu?.some((group) =>
                group.some(
                  (item) =>
                    !item.selectors || item.selectors.some((s) => target.selectors.includes(s))
                )
              );
            const props = selectable
              ? {
                  class: 'selectable',
                  onClick: () => selected.set(target),
                  onMouseEnter: () => focused.set(target),
                  onMouseLeave: () => focused.set(undefined),
                }
              : selectedElement
                ? { class: 'selected', onClick: () => selected.set(undefined) }
                : {};
            const asButton = selectable || selectedElement;
            return createElement('li', props, [
              createElement(asButton ? 'button' : 'div', asButton ? { type: 'button' } : {}, [
                selectedElement ? createIcon('chevronLeft') : null,
                createElement('code', {}, [target.element.outerHTML]),
                selectable ? createIcon('chevronRight') : null,
              ]),
            ]);
          })
        )
      );
    }

    if (selected.get() || targets.get().length === 1) {
      const target = selected.get() || targets.get()[0];
      const menuGroups = target.menu?.filter((group) =>
        group.some(
          (item) => !item.selectors || item.selectors.some((s) => target.selectors.includes(s))
        )
      );
      if (menuGroups?.length) {
        menu.appendChild(
          createElement(
            'ul',
            { class: 'menu-list' },
            menuGroups.map((menuItems) =>
              createElement('li', {}, [
                createElement(
                  'ul',
                  { class: 'menu-items' },
                  menuItems.map(
                    ({ id, title, description, iconLeft, iconRight, clickEvent: event }) => {
                      const onClick =
                        event && (() => channel.emit(event, id, getEventDetails(target)));
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
                    }
                  )
                ),
              ])
            )
          )
        );
      }
    }

    const coords = clickCoords.get();
    if (coords) {
      Object.assign(menu.style, {
        display: 'block',
        left: `${menu.style.position === 'fixed' ? coords.x - window.scrollX : coords.x}px`,
        top: `${menu.style.position === 'fixed' ? coords.y - window.scrollY : coords.y}px`,
      });

      // Put the menu in #top-layer, above any other popovers and z-indexes
      showPopover(menu);

      // Reposition the menu on after it renders, to avoid rendering outside the viewport
      requestAnimationFrame(() => keepInViewport(menu, coords, { topOffset: 15, centered: true }));
    } else {
      hidePopover(menu);
      Object.assign(menu.style, { display: 'none' });
    }
  };
  targets.subscribe(renderMenu);
  selected.subscribe(renderMenu);

  //
  // Channel event handlers
  //

  const addHighlight = (highlight: RawHighlightOptions) => {
    const info = normalizeOptions(highlight);
    highlights.set((value) => {
      const others = info.id ? value.filter((h) => h.id !== info.id) : value;
      return info.selectors?.length ? [...others, info] : others;
    });
  };

  const removeHighlight = (id: string) => {
    if (id) {
      highlights.set((value) => value.filter((h) => h.id !== id));
    }
  };

  const resetState = () => {
    highlights.set([]);
    elements.set(new Map());
    boxes.set([]);
    clickCoords.set(undefined);
    hoverCoords.set(undefined);
    targets.set([]);
    hovered.set([]);
    focused.set(undefined);
    selected.set(undefined);
  };

  let removeTimeout: NodeJS.Timeout;
  const scrollIntoView = (target: string, options?: ScrollIntoViewOptions) => {
    const id = 'scrollIntoView-highlight';
    clearTimeout(removeTimeout);
    removeHighlight(id);

    const element = document.querySelector(target);
    if (!element) {
      console.warn(`Cannot scroll into view: ${target} not found`);
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center', ...options });
    const keyframeName = `kf-${Math.random().toString(36).substring(2, 15)}`;
    highlights.set((value) => [
      ...value,
      {
        id,
        priority: 1000,
        selectors: [target],
        styles: {
          outline: '2px solid #1EA7FD',
          outlineOffset: '-1px',
          animation: `${keyframeName} 3s linear forwards`,
        },
        keyframes: `@keyframes ${keyframeName} {
          0% { outline: 2px solid #1EA7FD; }
          20% { outline: 2px solid #1EA7FD00; }
          40% { outline: 2px solid #1EA7FD; }
          60% { outline: 2px solid #1EA7FD00; }
          80% { outline: 2px solid #1EA7FD; }
          100% { outline: 2px solid #1EA7FD00; }
        }`,
      },
    ]);
    removeTimeout = setTimeout(() => removeHighlight(id), 3500);
  };

  const onMouseMove = (event: MouseEvent): void => {
    requestAnimationFrame(() => hoverCoords.set({ x: event.pageX, y: event.pageY }));
  };

  document.body.addEventListener('mousemove', onMouseMove);

  channel.on(HIGHLIGHT, addHighlight);
  channel.on(REMOVE_HIGHLIGHT, removeHighlight);
  channel.on(RESET_HIGHLIGHT, resetState);
  channel.on(SCROLL_INTO_VIEW, scrollIntoView);
  channel.on(STORY_RENDER_PHASE_CHANGED, ({ newPhase }: { newPhase: string }) => {
    if (newPhase === 'loading') {
      resetState();
    }
  });
};
