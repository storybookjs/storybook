import { useEffect, useGlobals } from 'storybook/preview-api';

import { DEFAULT_SETTINGS, GLOBAL_KEY, SETTINGS_ROUTE, type GridSettings } from './constants.ts';

const settings: Promise<GridSettings> = fetch(SETTINGS_ROUTE)
  .then((response) => (response.ok ? response.json() : DEFAULT_SETTINGS))
  .catch(() => DEFAULT_SETTINGS);

function gridCss({ size, color }: GridSettings): string {
  return `body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image: linear-gradient(to right, ${color} 1px, transparent 1px),
      linear-gradient(to bottom, ${color} 1px, transparent 1px);
    background-size: ${size}px ${size}px;
  }`;
}

function withGrid<T>(storyFn: () => T): T {
  const [globals] = useGlobals();
  const isActive = globals[GLOBAL_KEY] === true;

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const style = document.createElement('style');
    document.head.append(style);
    settings.then((value) => (style.textContent = gridCss(value)));
    return () => style.remove();
  }, [isActive]);

  return storyFn();
}

export const decorators = [withGrid];

export const initialGlobals = { [GLOBAL_KEY]: false };
