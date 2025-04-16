import type { Box, Highlight, HighlightOptions, RawHighlightOptions } from './types';

const svgElements = 'svg,path,rect,circle,line,polyline,polygon,ellipse,text'.split(',');

export const createElement = (type: string, props: Record<string, any>, children?: any[]) => {
  const element = svgElements.includes(type)
    ? document.createElementNS('http://www.w3.org/2000/svg', type)
    : document.createElement(type);

  Object.entries(props).forEach(([key, val]) => {
    if (/[A-Z]/.test(key)) {
      if (key === 'onClick') {
        element.addEventListener('click', val);
        (element as HTMLButtonElement).addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            val();
          }
        });
      }
      if (key === 'onMouseEnter') {
        element.addEventListener('mouseenter', val);
      }
      if (key === 'onMouseLeave') {
        element.addEventListener('mouseleave', val);
      }
    } else {
      element.setAttribute(key, val);
    }
  });

  children?.forEach((child) => {
    if (child === null || child === undefined || child === false) {
      return;
    }
    try {
      element.appendChild(child as Node);
    } catch (e) {
      element.appendChild(document.createTextNode(String(child)));
    }
  });

  return element;
};

export const convertLegacy = (highlight: RawHighlightOptions): HighlightOptions => {
  if ('elements' in highlight) {
    const { elements, color, style } = highlight;
    return {
      selectors: elements,
      styles: {
        outline: `2px ${style} ${color}`,
        outlineOffset: '2px',
        boxShadow: '0 0 0 6px rgba(255,255,255,0.6)',
      },
    };
  }
  return highlight;
};

export const isFunction = (obj: unknown): obj is (...args: any[]) => any => obj instanceof Function;

type Listener<T> = (value: T) => void | (() => void);

const state = new Map<symbol, any>();
const listeners = new Map<symbol, Listener<any>[]>();
const teardowns = new Map<Listener<any>, ReturnType<Listener<any>>>();

export const useStore = <T>(initialValue?: T) => {
  const key = Symbol();
  listeners.set(key, []);
  state.set(key, initialValue);

  const get = () => state.get(key) as T;
  const set = (update: T | ((state: T) => T)) => {
    const current = state.get(key) as T;
    const next = isFunction(update) ? update(current) : update;
    if (next !== current) {
      state.set(key, next);
      listeners.get(key)?.forEach((listener) => {
        teardowns.get(listener)?.();
        teardowns.set(listener, listener(next));
      });
    }
  };
  const subscribe = (listener: Listener<T>) => {
    listeners.get(key)?.push(listener);
    return () => listeners.get(key)?.filter((l) => l !== listener);
  };
  const teardown = () => {
    listeners.get(key)?.forEach((listener) => {
      teardowns.get(listener)?.();
      teardowns.delete(listener);
    });
    listeners.delete(key);
    state.delete(key);
  };

  return { get, set, subscribe, teardown } as const;
};

export const mapElements = (highlights: HighlightOptions[]): Map<HTMLElement, Highlight> => {
  const root = document.getElementById('storybook-root');
  const map = new Map();
  for (const highlight of highlights) {
    const { priority = 0, selectable = !!highlight.menu } = highlight;
    for (const selector of highlight.selectors) {
      for (const element of root?.querySelectorAll(selector) || []) {
        const existing = map.get(element);
        if (!existing || existing.priority < priority) {
          map.set(element, {
            ...highlight,
            priority,
            selectors: (existing?.selectors || []).concat(selector),
            selectable,
          });
        }
      }
    }
  }
  return map;
};

export const mapBoxes = (elements: Map<HTMLElement, Highlight>): Box[] =>
  Array.from(elements.entries())
    .map<Box>(([element, { selectors, styles, hoverStyles, focusStyles, selectable, menu }]) => {
      const { top, left, width, height } = element.getBoundingClientRect();
      const { position } = getComputedStyle(element);
      return {
        element,
        selectors,
        selectable,
        styles,
        hoverStyles,
        focusStyles,
        menu,
        top: position === 'fixed' ? top : top + window.scrollY,
        left: position === 'fixed' ? left : left + window.scrollX,
        width,
        height,
      };
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);

export const isOverMenu = (menuElement: HTMLElement, coordinates: { x: number; y: number }) => {
  const menu = menuElement.getBoundingClientRect();
  const { x, y } = coordinates;
  return (
    menu?.top &&
    menu?.left &&
    x >= menu.left &&
    x <= menu.left + menu.width &&
    y >= menu.top &&
    y <= menu.top + menu.height
  );
};

export const isTargeted = (
  box: Box,
  boxElement: HTMLElement,
  coordinates: { x: number; y: number }
) => {
  if (!coordinates) {
    return false;
  }
  let { left, top } = box;
  if (boxElement.style.position === 'fixed') {
    left += window.scrollX;
    top += window.scrollY;
  }
  const { x, y } = coordinates;
  return x >= left && x <= left + box.width && y >= top && y <= top + box.height;
};

export const keepInViewport = (
  element: HTMLElement,
  targetCoordinates: { x: number; y: number },
  options: { margin?: number; topOffset?: number; centered?: boolean } = {}
) => {
  const { x, y } = targetCoordinates;
  const { margin = 5, topOffset = 0, centered = false } = options;
  const { scrollX, scrollY, innerHeight: windowHeight, innerWidth: windowWidth } = window;

  const top = Math.min(
    element.style.position === 'fixed' ? y - scrollY : y,
    windowHeight - element.clientHeight - margin - topOffset + scrollY
  );

  const leftOffset = centered ? element.clientWidth / 2 : 0;
  const left =
    element.style.position === 'fixed'
      ? Math.max(Math.min(x - scrollX, windowWidth - leftOffset - margin), leftOffset + margin)
      : Math.max(
          Math.min(x, windowWidth - leftOffset - margin + scrollX),
          leftOffset + margin + scrollX
        );

  Object.assign(element.style, {
    ...(left !== x && { left: `${left}px` }),
    ...(top !== y && { top: `${top}px` }),
  });
};

const supportsPopover = HTMLElement.prototype.hasOwnProperty('showPopover');
export const showPopover = (element: HTMLElement) => {
  if (supportsPopover) {
    element.showPopover();
  }
};
export const hidePopover = (element: HTMLElement) => {
  if (supportsPopover) {
    element.hidePopover();
  }
};
