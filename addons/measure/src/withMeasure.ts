/* eslint-env browser */
import { useEffect } from 'storybook/internal/preview-api';
import type {
  Renderer,
  StoryContext,
  PartialStoryFn as StoryFunction,
} from 'storybook/internal/types';

import { destroy, init, rescale } from './box-model/canvas';
import { drawSelectedElement } from './box-model/visualizer';
import { deepElementFromPoint } from './util';

let nodeAtPointerRef;
const pointer = { x: 0, y: 0 };

function findAndDrawElement(x: number, y: number) {
  nodeAtPointerRef = deepElementFromPoint(x, y);
  drawSelectedElement(nodeAtPointerRef);
}

export const withMeasure = (StoryFn: StoryFunction<Renderer>, context: StoryContext<Renderer>) => {
  const { measureEnabled } = context.globals;

  useEffect(() => {
    const onPointerMove = (event: MouseEvent) => {
      window.requestAnimationFrame(() => {
        event.stopPropagation();
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      });
    };

    document.addEventListener('pointermove', onPointerMove);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  useEffect(() => {
    const onPointerOver = (event: MouseEvent) => {
      window.requestAnimationFrame(() => {
        event.stopPropagation();
        findAndDrawElement(event.clientX, event.clientY);
      });
    };

    const onResize = () => {
      window.requestAnimationFrame(() => {
        rescale();
      });
    };

    if (context.viewMode === 'story' && measureEnabled) {
      document.addEventListener('pointerover', onPointerOver);
      init();
      window.addEventListener('resize', onResize);
      // Draw the element below the pointer when first enabled
      findAndDrawElement(pointer.x, pointer.y);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      destroy();
    };
  }, [measureEnabled, context.viewMode]);

  return StoryFn();
};
