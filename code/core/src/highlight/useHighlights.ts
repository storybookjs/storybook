/// <reference path="./typings.d.ts" />
/* eslint-env browser */
import type { Channel } from 'storybook/internal/channels';
import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import {
  HIGHLIGHT,
  HIGHLIGHT_MENU,
  HIGHLIGHT_MENU_INTERACTION,
  MAX_Z_INDEX,
  MIN_TOUCH_AREA_SIZE,
  REMOVE_HIGHLIGHT,
  RESET_HIGHLIGHT,
  SCROLL_INTO_VIEW,
} from './constants.ts';
import type { Box, Highlight, HighlightMenuInteraction, HighlightOptions } from './types.ts';
import {
  createElement,
  getEventDetails,
  isTargeted,
  mapBoxes,
  mapElements,
  normalizeOptions,
  showPopover,
  useStore,
} from './utils.ts';

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
  // The click position relative to the first target's box, used to keep the (manager-rendered)
  // menu anchored to its element while the preview scrolls, resizes or otherwise changes layout.
  const menuAnchor = useStore<
    { element: HTMLElement; offsetX: number; offsetY: number } | undefined
  >();

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
      // The targetable boxes may get repositioned, so we wait for the next frame before checking
      requestAnimationFrame(() => {
        const coords = { x: event.pageX, y: event.pageY };
        // Update menu coordinates and clicked target boxes based on the click position
        const results = targetable.filter((box) => {
          const boxElement = boxElementByTargetElement.get(box.element)!;
          return isTargeted(box, boxElement, coords);
        });
        clickCoords.set(results.length ? coords : undefined);
        targets.set(results);

        // Track the click position relative to the first target's box, so the manager-rendered
        // menu can stay anchored to its element while the preview changes.
        if (results.length) {
          const anchorBox = results[0];
          const isFixed = getComputedStyle(anchorBox.element).position === 'fixed';
          menuAnchor.set({
            element: anchorBox.element,
            offsetX: (isFixed ? coords.x - window.scrollX : coords.x) - anchorBox.left,
            offsetY: (isFixed ? coords.y - window.scrollY : coords.y) - anchorBox.top,
          });
        } else {
          menuAnchor.set(undefined);
        }
      });
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  });

  const updateHovered = () => {
    const coords = hoverCoords.get();
    if (!coords) {
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

  //
  // Menu (rendered by the manager)
  //
  // The interactive menu used to be rendered inside the preview. It is now rendered by the manager
  // and positioned over the preview iframe, so it can no longer be triggered by embedding the
  // preview on a malicious site. The preview tracks the state and sends it to the manager.

  /** The menu anchor in the preview iframe's viewport coordinates. */
  const getMenuCoords = () => {
    const click = clickCoords.get();
    if (!click) {
      return undefined;
    }

    const anchor = menuAnchor.get();
    if (anchor) {
      const box = boxes.get().find((b) => b.element === anchor.element);
      if (box) {
        const isFixed = getComputedStyle(box.element).position === 'fixed';
        return {
          x: box.left + anchor.offsetX - (isFixed ? 0 : window.scrollX),
          y: box.top + anchor.offsetY - (isFixed ? 0 : window.scrollY),
        };
      }
    }

    return { x: click.x - window.scrollX, y: click.y - window.scrollY };
  };

  const emitMenuState = () => {
    const targetList = targets.get();
    const coords = targetList.length ? getMenuCoords() : undefined;
    const selectedBox = selected.get();
    const selectedIndex = selectedBox
      ? targetList.findIndex((b) => b.element === selectedBox.element)
      : undefined;

    channel.emit(HIGHLIGHT_MENU, {
      targets: targetList.map((box) => ({ menu: box.menu, details: getEventDetails(box) })),
      selected: selectedIndex !== undefined && selectedIndex >= 0 ? selectedIndex : null,
      coords: coords ?? null,
    });
  };

  // Keep the manager-rendered menu in sync while it is open: boxes are remeasured on preview
  // scrolling, resizing, layout changes and DOM mutations.
  boxes.subscribe(() => {
    if (clickCoords.get()) {
      emitMenuState();
    }
  });
  targets.subscribe(emitMenuState);
  selected.subscribe(emitMenuState);

  const handleMenuInteraction = ({
    action,
    index,
  }: Pick<HighlightMenuInteraction, 'action' | 'index'>) => {
    const targetList = targets.get();
    const box = typeof index === 'number' ? targetList[index] : undefined;
    switch (action) {
      case 'select':
        if (box) {
          selected.set(box);
        }
        break;
      case 'deselect':
        selected.set(undefined);
        break;
      case 'focus':
        if (box) {
          focused.set(box);
        }
        break;
      case 'blur':
        focused.set(undefined);
        break;
    }
  };

  //
  // Channel event handlers
  //

  const addHighlight = (highlight: HighlightOptions) => {
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
    menuAnchor.set(undefined);
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
  channel.on(HIGHLIGHT_MENU_INTERACTION, handleMenuInteraction);
  channel.on(STORY_RENDER_PHASE_CHANGED, ({ newPhase }: { newPhase: string }) => {
    if (newPhase === 'loading') {
      resetState();
    }
  });
};
