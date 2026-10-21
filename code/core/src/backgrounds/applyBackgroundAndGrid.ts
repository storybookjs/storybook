import type { BeforeEach } from 'storybook/internal/types';

import { PARAM_KEY } from './constants.ts';
import { DEFAULT_BACKGROUNDS } from './defaults.ts';
import type { BackgroundsParameters, GridConfig } from './types.ts';
import { addBackgroundStyle, addGridStyle, clearStyles, isReduceMotionEnabled } from './utils.ts';

const defaultGrid: GridConfig = {
  cellSize: 100,
  cellAmount: 10,
  opacity: 0.8,
};

const BG_SELECTOR_BASE = `addon-backgrounds`;
const GRID_SELECTOR_BASE = 'addon-backgrounds-grid';

const transitionStyle = isReduceMotionEnabled() ? '' : 'transition: background-color 0.3s;';

// Runs before every render of a story, also of one that runs no decorators, and leaves nothing
// once the story is left.
export const applyBackgroundAndGrid: BeforeEach = (context) => {
  const { globals = {}, parameters = {}, viewMode, id } = context;
  const {
    options = DEFAULT_BACKGROUNDS,
    disable,
    grid = defaultGrid,
  } = (parameters[PARAM_KEY] || {}) as NonNullable<BackgroundsParameters['backgrounds']>;
  const data = globals[PARAM_KEY] || {};
  const backgroundName: string | undefined = typeof data === 'string' ? data : data?.value;

  const item = backgroundName ? options[backgroundName] : undefined;
  const value = typeof item === 'string' ? item : item?.value || 'transparent';

  const showGrid = typeof data === 'string' ? false : data.grid || false;
  const shownBackground = !!item && !disable;

  // A story with layout 'document' owns the body, whichever body the document has.
  const selector =
    viewMode === 'docs'
      ? `#anchor--${id} .docs-story, #anchor--primary--${id} .docs-story`
      : parameters.layout === 'document'
        ? 'body'
        : '.sb-show-main';

  const isLayoutPadded = parameters.layout === undefined || parameters.layout === 'padded';
  const defaultOffset = viewMode === 'docs' ? 20 : isLayoutPadded ? 16 : 0;
  const { cellAmount, cellSize, opacity, offsetX = defaultOffset, offsetY = defaultOffset } = grid;

  const backgroundSelectorId =
    viewMode === 'docs' ? `${BG_SELECTOR_BASE}-docs-${id}` : `${BG_SELECTOR_BASE}-color`;
  const backgroundTarget = viewMode === 'docs' ? id : null;
  const gridSelectorId =
    viewMode === 'docs' ? `${GRID_SELECTOR_BASE}-docs-${id}` : `${GRID_SELECTOR_BASE}`;

  if (shownBackground) {
    // Only a change of a background already shown fades: a story shows with its background at once.
    const transition = globalThis.document?.getElementById(backgroundSelectorId)
      ? transitionStyle
      : '';
    const backgroundStyles = `
    ${selector} {
      background: ${value} !important;
      ${transition}
      }`;

    addBackgroundStyle(backgroundSelectorId, backgroundStyles, backgroundTarget);
  } else {
    clearStyles(backgroundSelectorId);
  }

  if (showGrid) {
    const gridSize = [
      `${cellSize * cellAmount}px ${cellSize * cellAmount}px`,
      `${cellSize * cellAmount}px ${cellSize * cellAmount}px`,
      `${cellSize}px ${cellSize}px`,
      `${cellSize}px ${cellSize}px`,
    ].join(', ');

    const gridStyles = `
        ${selector} {
          background-size: ${gridSize} !important;
          background-position: ${offsetX}px ${offsetY}px, ${offsetX}px ${offsetY}px, ${offsetX}px ${offsetY}px, ${offsetX}px ${offsetY}px !important;
          background-blend-mode: difference !important;
          background-image: linear-gradient(rgba(130, 130, 130, ${opacity}) 1px, transparent 1px),
           linear-gradient(90deg, rgba(130, 130, 130, ${opacity}) 1px, transparent 1px),
           linear-gradient(rgba(130, 130, 130, ${opacity / 2}) 1px, transparent 1px),
           linear-gradient(90deg, rgba(130, 130, 130, ${
             opacity / 2
           }) 1px, transparent 1px) !important;
        }
      `;

    addGridStyle(gridSelectorId, gridStyles);
  } else {
    clearStyles(gridSelectorId);
  }

  return () => clearStyles([backgroundSelectorId, gridSelectorId]);
};
