import { global } from '@storybook/global';

import invariant from 'tiny-invariant';

interface Size {
  width: number;
  height: number;
}

interface CanvasState {
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
  width?: number;
  height?: number;
}

function getDocumentWidthAndHeight() {
  const container = global.document.documentElement;

  const height = Math.max(container.scrollHeight, container.offsetHeight);
  const width = Math.max(container.scrollWidth, container.offsetWidth);
  return { width, height };
}

function createCanvas(): CanvasState {
  const canvas = global.document.createElement('canvas');
  canvas.id = 'storybook-addon-measure';
  const context = canvas.getContext('2d');
  invariant(context != null);
  // Set canvas width & height
  const { width, height } = getDocumentWidthAndHeight();
  setCanvasWidthAndHeight(canvas, context, { width, height });
  // Position canvas
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.zIndex = '2147483647';
  // Disable any user interactions
  canvas.style.pointerEvents = 'none';
  global.document.body.appendChild(canvas);

  return { canvas, context, width, height };
}

function setCanvasWidthAndHeight(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  { width, height }: Size
) {
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale
  const scale = global.window.devicePixelRatio;
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);

  // Normalize coordinate system to use css pixels.
  context.scale(scale, scale);
}

let state: CanvasState = {};

export function init() {
  if (!state.canvas) {
    state = createCanvas();
  }
}

export function clear() {
  if (state.context) {
    state.context.clearRect(0, 0, state.width ?? 0, state.height ?? 0);
  }
}

export function draw(callback: (context?: CanvasRenderingContext2D) => void) {
  clear();
  callback(state.context);
}

export function rescale() {
  invariant(state.canvas, 'Canvas should exist in the state.');
  invariant(state.context, 'Context should exist in the state.');
  // First reset so that the canvas size doesn't impact the container size
  setCanvasWidthAndHeight(state.canvas, state.context, { width: 0, height: 0 });

  const { width, height } = getDocumentWidthAndHeight();
  setCanvasWidthAndHeight(state.canvas, state.context, { width, height });

  // update state
  state.width = width;
  state.height = height;
}

export function destroy() {
  if (state.canvas) {
    clear();
    state.canvas.parentNode?.removeChild(state.canvas);
    state = {};
  }
}
