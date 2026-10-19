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
