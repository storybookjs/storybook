import { describe, expect, it, vi } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

import { decorateStory } from './decorators.ts';
import type { SvelteRenderer } from './types.ts';

vi.mock('@storybook/svelte/internal/DecoratorHandler.svelte', () => ({
  default: function DecoratorHandler() {},
}));

describe('decorateStory', () => {
  it('wraps the story in a decorator that returns a component without docgen', () => {
    function StoryComponent() {}
    function Border() {}
    const context = { component: StoryComponent } as unknown as StoryContext<SvelteRenderer>;

    const decorated = decorateStory(() => ({}), [() => Border]);

    expect(decorated(context).props.decorator).toEqual({ Component: Border });
  });
});
