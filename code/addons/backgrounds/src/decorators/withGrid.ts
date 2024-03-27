import { useMemo, useEffect } from '@storybook/preview-api';
import type { Renderer, PartialStoryFn as StoryFunction, StoryContext } from '@storybook/types';

import { clearStyles, addGridElement, getParentElement } from '../helpers';
import { PARAM_KEY as BACKGROUNDS_PARAM_KEY } from '../constants';

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
    const backgroundSize = [
      `${cellSize * cellAmount}px ${cellSize * cellAmount}px`,
      `${cellSize * cellAmount}px ${cellSize * cellAmount}px`,
      `${cellSize}px ${cellSize}px`,
      `${cellSize}px ${cellSize}px`,
    ].join(', ');

    const parentSelector =
      context.viewMode === 'docs' ? `#anchor--${context.id} .docs-story` : '.sb-show-main';

    return `
      /** this ensures the we fill the whole space **/
      html {
        height: 100%;
      }

      ${parentSelector} {
        position: relative;
        height: 100%;
      }

      /** adds z-index to the canvas so it's always on top if grid is enabled **/
      #storybook-root:not([hidden]),
      .docs-story > div:first-child {
        position: relative;
        z-index: 1;
      }

      /** append the grid into the parent selector, with z-index: 0 to ensure it's behind the canvas **/
      ${parentSelector} .grid {
        z-index: 0;
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
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

    const parentElement = getParentElement(context.viewMode, context.id);
    addGridElement(selectorId, gridStyles, parentElement);
  }, [isActive, gridStyles, context]);

  return StoryFn();
};
