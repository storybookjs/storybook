/* eslint-env browser */
import type { AfterEach, BeforeEach, StoryContext } from 'storybook/internal/types';

import { destroy, init, rescale } from './box-model/canvas.ts';
import { drawSelectedElement } from './box-model/visualizer.ts';
import { deepElementFromPoint } from './util.ts';

const pointer = { x: 0, y: 0 };

function findAndDrawElement(x: number, y: number) {
  drawSelectedElement(deepElementFromPoint(x, y));
}

const isMeasuring = (context: StoryContext) =>
  context.viewMode === 'story' &&
  !!context.globals?.measureEnabled &&
  !context.parameters?.measure?.disable;

const onPointerMove = (event: PointerEvent) => {
  window.requestAnimationFrame(() => {
    event.stopPropagation();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
};

const onPointerOver = (event: PointerEvent) => {
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

const stopMeasuring = () => {
  globalThis.document.removeEventListener('pointerover', onPointerOver);
  globalThis.window.removeEventListener('resize', onResize);
  destroy();
};

const leave = () => {
  globalThis.document.removeEventListener('pointermove', onPointerMove);
  stopMeasuring();
};

// Runs before every render of a story, also of one that runs no decorators, and leaves nothing
// once the story is left. A rerender adds no second listener: the listeners are the same functions.
export const applyMeasure: BeforeEach = (context) => {
  if (typeof globalThis.document === 'undefined') {
    return;
  }

  globalThis.document.addEventListener('pointermove', onPointerMove);

  if (isMeasuring(context)) {
    globalThis.document.addEventListener('pointerover', onPointerOver);
    globalThis.window.addEventListener('resize', onResize);
    init();
  } else {
    stopMeasuring();
  }

  return leave;
};

// Draws the element below the pointer once the story has rendered, without waiting for the pointer
// to move.
export const drawAtPointer: AfterEach = (context) => {
  if (typeof globalThis.document !== 'undefined' && isMeasuring(context)) {
    findAndDrawElement(pointer.x, pointer.y);
  }
};
