/* eslint-env browser */
import type { DecoratorFunction } from 'storybook/internal/types';

import { useEffect } from 'storybook/preview-api';

import { destroy, init, rescale } from './box-model/canvas';
import { drawSelectedElement } from './box-model/visualizer';
import { deepElementFromPoint } from './util';

let nodeAtPointerRef;
const pointer = { x: 0, y: 0 };

function findAndDrawElement(x: number, y: number) {
  nodeAtPointerRef = deepElementFromPoint(x, y);
  drawSelectedElement(nodeAtPointerRef);
}

export const withMeasure: DecoratorFunction = (StoryFn, context) => {
  const { measureEnabled } = context.globals || {};

  useEffect(() => {
    if (typeof globalThis.document === 'undefined') {
      return;
    }

    const onPointerMove = (event: MouseEvent) => {
      window.requestAnimationFrame(() => {
        event.stopPropagation();
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      });
    };

    globalThis.document.addEventListener('pointermove', onPointerMove);

    return () => {
      globalThis.document.removeEventListener('pointermove', onPointerMove);
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
      globalThis.document.addEventListener('pointerover', onPointerOver);
      init();
      globalThis.window.addEventListener('resize', onResize);
      // Draw the element below the pointer when first enabled
      findAndDrawElement(pointer.x, pointer.y);
    }

    return () => {
      globalThis.window.removeEventListener('resize', onResize);
      destroy();
    };
  }, [measureEnabled, context.viewMode]);

  return StoryFn();
};
