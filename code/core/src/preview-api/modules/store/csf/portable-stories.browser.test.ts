// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';

import { composeStory } from './portable-stories.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('removes animation listeners when afterEach throws', async () => {
  const canvasElement = document.createElement('div');
  const getAnimations = vi.fn(() => []);
  vi.stubGlobal('document', {
    createElement: document.createElement.bind(document),
    querySelectorAll: document.querySelectorAll.bind(document),
    getAnimations,
  });
  vi.stubGlobal('__vitest_browser__', true);
  const error = new Error('afterEach failed');

  const story = composeStory(
    { render: () => {} },
    {},
    {
      afterEach: async () => {
        expect(getAnimations).toHaveBeenCalledOnce();
        throw error;
      },
      mount: (context) => async () => context.canvas,
    }
  );

  await expect(story.run({ canvasElement })).rejects.toBe(error);

  dispatchEvent(new Event('animationstart'));
  dispatchEvent(new Event('transitionrun'));

  expect(getAnimations).toHaveBeenCalledOnce();
});

it('renders a story that owns the document to the <body>, and has the <body> the render left', async () => {
  const bodies: HTMLElement[] = [];
  const before = document.body;
  const story = composeStory(
    {
      render: () => {},
      parameters: { layout: 'document' },
      play: async ({ canvasElement }) => {
        bodies.push(canvasElement);
      },
    },
    {},
    {
      renderToCanvas: (_, canvasElement) => {
        bodies.push(canvasElement);
        // As a render of a document does: a new <body>.
        document.documentElement.replaceChild(document.createElement('body'), document.body);
      },
    }
  );

  await story.run();

  expect(bodies).toEqual([before, document.body]);
  expect(document.body).not.toBe(before);
  // No container of its own.
  expect(document.body.children).toHaveLength(0);
});
