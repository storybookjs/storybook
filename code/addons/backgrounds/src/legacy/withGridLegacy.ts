import { useEffect, useMemo } from 'storybook/internal/preview-api';
import type {
  Renderer,
  StoryContext,
  PartialStoryFn as StoryFunction,
} from 'storybook/internal/types';

import { PARAM_KEY as BACKGROUNDS_PARAM_KEY } from '../constants';
import { addGridStyle, clearStyles } from '../utils';

export const withGrid = (StoryFn: StoryFunction<Renderer>, context: StoryContext<Renderer>) => {
  const { globals, parameters } = context;
  const gridParameters = parameters[BACKGROUNDS_PARAM_KEY].grid;
  const isActive = globals[BACKGROUNDS_PARAM_KEY]?.grid === true && gridParameters.disable !== true;
  const { cellAmount, cellSize, opacity } = gridParameters;
  const isInDocs = context.viewMode === 'docs';

  const isLayoutPadded = parameters.layout === undefined || parameters.layout === 'padded';
  // 16px offset in the grid to account for padded layout
  const defaultOffset = isLayoutPadded ? 16 : 0;
  const offsetX = gridParameters.offsetX ?? (isInDocs ? 20 : defaultOffset);
  const offsetY = gridParameters.offsetY ?? (isInDocs ? 20 : defaultOffset);

  const gridStyles = useMemo(() => {
    const selector =
      context.viewMode === 'docs' ? `#anchor--${context.id} .docs-story` : '.sb-show-main';

    const backgroundSize = [
      `${cellSize * cellAmount}px ${cellSize * cellAmount}px`,
      `${cellSize * cellAmount}px ${cellSize * cellAmount}px`,
      `${cellSize}px ${cellSize}px`,
      `${cellSize}px ${cellSize}px`,
    ].join(', ');

    return `
      ${selector} {
        background-size: ${backgroundSize} !important;
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
  }, [cellSize]);

  useEffect(() => {
    const selectorId =
      context.viewMode === 'docs'
        ? `addon-backgrounds-grid-docs-${context.id}`
        : `addon-backgrounds-grid`;
    if (!isActive) {
      clearStyles(selectorId);
      return;
    }

    addGridStyle(selectorId, gridStyles);
  }, [isActive, gridStyles, context]);

  return StoryFn();
};
