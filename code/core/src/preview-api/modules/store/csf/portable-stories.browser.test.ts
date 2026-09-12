// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';

import { composeStory } from './portable-stories.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style').forEach((style) => style.remove());
});

it('restores animations when afterEach throws', async () => {
  vi.stubGlobal('__vitest_browser__', true);

  const story = composeStory(
    { render: () => {} },
    {},
    {
      afterEach: async () => {
        throw new Error('afterEach failed');
      },
      mount: (context) => async () => context.canvas,
    }
  );

  await expect(story.run()).rejects.toThrow('afterEach failed');

  expect(document.head.textContent).not.toContain('animation-play-state: paused');
});
