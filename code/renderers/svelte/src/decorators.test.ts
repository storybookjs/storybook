import { describe, expect, it, vi } from 'vitest';

import type { StoryContextForRender } from 'storybook/internal/types';

import { decorateStory } from './decorators.ts';
import type { SvelteRenderer } from './types.ts';

vi.mock('@storybook/svelte/internal/DecoratorHandler.svelte', () => ({
  default: function DecoratorHandler() {},
}));

describe('decorateStory', () => {
  it('wraps the story in a decorator that returns a component without docgen', () => {
    function StoryComponent() {}
    function Border() {}
    const context = {
      component: StoryComponent,
      argTypes: {},
    } as unknown as StoryContextForRender<SvelteRenderer>;

    const decorated = decorateStory(() => ({}), [() => Border]);

    expect(decorated(context).props.decorator).toEqual({ Component: Border });
  });
});
