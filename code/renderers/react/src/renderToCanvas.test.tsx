// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FC } from 'react';
import React, { useState } from 'react';

import type { RenderContext } from 'storybook/internal/types';

import { renderToCanvas } from './renderToCanvas.tsx';
import type { ReactRenderer } from './types.ts';

let canvasElement: HTMLElement;
let teardown: (() => Promise<void>) | undefined;

beforeEach(() => {
  canvasElement = document.createElement('div');
  document.body.appendChild(canvasElement);
});

afterEach(async () => {
  await teardown?.();
  teardown = undefined;
  canvasElement.remove();
});

const makeRenderContext = (
  StoryComponent: FC,
  {
    forceRemount = true,
    parameters = {},
    showMain = vi.fn(),
    showException = vi.fn(),
  }: Partial<RenderContext<ReactRenderer>> & { parameters?: Record<string, unknown> } = {}
) =>
  ({
    storyContext: { id: 'component--story', viewMode: 'story', parameters },
    unboundStoryFn: StoryComponent,
    showMain,
    showException,
    forceRemount,
  }) as unknown as RenderContext<ReactRenderer>;

const makeInstanceReporter = () => {
  let instanceCount = 0;
  const Story: FC = () => {
    const [instanceId] = useState(() => ++instanceCount);
    return <div>instance {instanceId}</div>;
  };
  return Story;
};

describe('renderToCanvas', () => {
  // Regression test for https://github.com/storybookjs/storybook/issues/22057: unmounting the
  // root before the replacement render leaves the canvas empty across task boundaries, and any
  // browser layout pass in that window clamps the scroll position to 0.
  it('replaces the story in place on a same-story remount, without emptying the canvas between tasks', async () => {
    teardown = await renderToCanvas(
      makeRenderContext(() => <div>version 1</div>),
      canvasElement
    );
    expect(canvasElement.textContent).toBe('version 1');

    // Sample at every microtask boundary to interleave with the render's own await points, but
    // yield a macrotask regularly: act() needs timers to progress, so a pure microtask loop
    // would deadlock the render it observes.
    const samples: number[] = [];
    let rendering = true;
    const sampler = (async () => {
      while (rendering) {
        for (let i = 0; i < 25 && rendering; i++) {
          samples.push(canvasElement.childElementCount);
          await Promise.resolve();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    })();

    try {
      teardown = await renderToCanvas(
        makeRenderContext(() => <div>version 2</div>),
        canvasElement
      );
    } finally {
      rendering = false;
    }
    await sampler;

    expect(canvasElement.textContent).toBe('version 2');
    expect(samples.length).toBeGreaterThan(0);
    expect(samples).not.toContain(0);
  });

  // https://github.com/storybookjs/react-storybook/issues/81
  it('recreates component instances on remount', async () => {
    const Story = makeInstanceReporter();

    teardown = await renderToCanvas(makeRenderContext(Story), canvasElement);
    expect(canvasElement.textContent).toBe('instance 1');

    teardown = await renderToCanvas(makeRenderContext(Story), canvasElement);
    expect(canvasElement.textContent).toBe('instance 2');
  });

  it('keeps component state on re-render without remount', async () => {
    const Story = makeInstanceReporter();

    teardown = await renderToCanvas(makeRenderContext(Story), canvasElement);
    teardown = await renderToCanvas(
      makeRenderContext(Story, { forceRemount: false }),
      canvasElement
    );
    expect(canvasElement.textContent).toBe('instance 1');
  });

  // The "preparing story" spinner is only cleared by showMain, so a remount that does not
  // call it again would leave the preview hidden behind the spinner.
  it('calls showMain again after each remount', async () => {
    const showMain = vi.fn();
    const Story: FC = () => <div>story</div>;

    teardown = await renderToCanvas(makeRenderContext(Story, { showMain }), canvasElement);
    expect(showMain).toHaveBeenCalledTimes(1);

    teardown = await renderToCanvas(makeRenderContext(Story, { showMain }), canvasElement);
    expect(showMain).toHaveBeenCalledTimes(2);
  });

  it('renders the new story after a remount recovers from a render error', async () => {
    const showMain = vi.fn();
    const showException = vi.fn();
    const Broken: FC = () => {
      throw new Error('boom');
    };

    teardown = await renderToCanvas(
      makeRenderContext(Broken, { showMain, showException }),
      canvasElement
    );
    expect(showException).toHaveBeenCalledOnce();
    expect(showMain).not.toHaveBeenCalled();

    teardown = await renderToCanvas(
      makeRenderContext(() => <div>fixed</div>, { showMain, showException }),
      canvasElement
    );
    expect(canvasElement.textContent).toBe('fixed');
    expect(showMain).toHaveBeenCalledOnce();
  });

  describe('portable stories', () => {
    // Portable stories render without the keyed ErrorBoundary, so a full unmount is what
    // guarantees per-run isolation: reconciling in place would leak component state from one
    // run of a story into the next.
    it('recreates component instances when the same story re-renders on the same canvas', async () => {
      const Story = makeInstanceReporter();
      const parameters = { __isPortableStory: true };

      teardown = await renderToCanvas(makeRenderContext(Story, { parameters }), canvasElement);
      expect(canvasElement.textContent).toBe('instance 1');

      teardown = await renderToCanvas(makeRenderContext(Story, { parameters }), canvasElement);
      expect(canvasElement.textContent).toBe('instance 2');
    });
  });
});
