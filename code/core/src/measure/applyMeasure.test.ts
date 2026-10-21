// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

// Draws nothing, on the real canvas.
vi.mock('./box-model/visualizer.ts', async () => {
  const { draw } = await import('./box-model/canvas.ts');
  return { drawSelectedElement: vi.fn(() => draw(() => {})) };
});

import { applyMeasure, drawAtPointer } from './applyMeasure.ts';
import { drawSelectedElement } from './box-model/visualizer.ts';

const CANVAS_ID = 'storybook-addon-measure';

const storyContext = (context: Partial<StoryContext>) =>
  ({
    viewMode: 'story',
    globals: { measureEnabled: true },
    parameters: {},
    ...context,
  }) as StoryContext;

const runBeforeEach = (context: Partial<StoryContext>) =>
  applyMeasure(storyContext(context)) as () => void;

const canvases = () => document.querySelectorAll<HTMLCanvasElement>(`#${CANVAS_ID}`);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const hover = async (element: Element) => {
  vi.mocked(drawSelectedElement).mockClear();
  element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  await nextFrame();
};

describe('applyMeasure', () => {
  beforeAll(() => {
    // happy-dom has no 2D canvas context.
    HTMLCanvasElement.prototype.getContext = function () {
      return { scale: () => {}, clearRect: () => {} };
    } as unknown as HTMLCanvasElement['getContext'];
  });

  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('shows the measure overlay when the measureEnabled global is set', () => {
    cleanup = runBeforeEach({});

    expect(canvases()).toHaveLength(1);
  });

  it('does not show the overlay when disabled via parameters, even if the global is on', () => {
    cleanup = runBeforeEach({ parameters: { measure: { disable: true } } });

    expect(canvases()).toHaveLength(0);
  });

  it('does not show the overlay in docs view', () => {
    cleanup = runBeforeEach({ viewMode: 'docs' });

    expect(canvases()).toHaveLength(0);
  });

  it('keeps the overlay out of the story root of a story that replaces the body', async () => {
    cleanup = runBeforeEach({ parameters: { layout: 'document' } });

    // A story with layout 'document' may replace the <body>, which is its root.
    const body = document.createElement('body');
    body.id = 'storybook-root';
    body.innerHTML = '<main id="page">Page</main>';
    document.documentElement.replaceChild(body, document.body);
    await hover(document.getElementById('page')!);

    expect(drawSelectedElement).toHaveBeenCalled();
    expect(canvases()).toHaveLength(1);
    expect(canvases()[0].parentElement).toBe(document.documentElement);
  });

  it('attaches the overlay again when a render cleared <html>', async () => {
    cleanup = runBeforeEach({ parameters: { layout: 'document' } });
    document.documentElement.replaceChildren(document.head, document.body);

    await hover(document.body);

    expect(canvases()).toHaveLength(1);
  });

  it('sizes the overlay to the document when it draws, after the story rendered', async () => {
    cleanup = runBeforeEach({});
    const scrollHeight = vi
      .spyOn(document.documentElement, 'scrollHeight', 'get')
      .mockReturnValue(2000);

    await hover(document.body);

    expect(canvases()[0].style.height).toBe('2000px');
    scrollHeight.mockRestore();
  });

  it('draws the element below the pointer once the story rendered', () => {
    cleanup = runBeforeEach({});
    vi.mocked(drawSelectedElement).mockClear();

    drawAtPointer(storyContext({}));

    expect(drawSelectedElement).toHaveBeenCalled();
  });

  it('keeps one overlay across rerenders, and removes it when the global is turned off', () => {
    cleanup = runBeforeEach({});
    runBeforeEach({});
    expect(canvases()).toHaveLength(1);

    runBeforeEach({ globals: { measureEnabled: false } });
    expect(canvases()).toHaveLength(0);
  });

  it('removes the overlay and stops drawing in its cleanup', async () => {
    runBeforeEach({})();
    expect(canvases()).toHaveLength(0);

    await hover(document.body);
    expect(drawSelectedElement).not.toHaveBeenCalled();
  });
});
