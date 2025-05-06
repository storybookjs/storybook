import type { StoryContext } from 'storybook/internal/types';
import { createRawSnippet, type Component, type ComponentProps } from 'svelte';
import { describe, expectTypeOf, it } from 'vitest';

import type { SvelteRenderer, ComponentAnnotations } from '$lib/types.js';

import Button from '../examples/components/Button.svelte';

describe('Meta', () => {
  it(`works correctly when no 'meta.component' entry provided`, () => {
    const meta = {
      args: {
        sample: 0,
      },
    } satisfies ComponentAnnotations<Component<{ sample: 0 }>, { sample: number }>;

    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<Component<{ sample?: 0 }>, { sample?: number }>
    >();
  });

  it('generic parameter can be a Svelte component', () => {
    const meta = {
      component: Button,
      args: {
        children: createRawSnippet(() => ({
          render: () => 'good',
        })),
        disabled: false,
        onclick: (event) => {
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).toMatchTypeOf<StoryContext<SvelteRenderer<typeof Button>>>();
      },
    } satisfies ComponentAnnotations<typeof Button, ComponentProps<typeof Button>>;

    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<typeof Button, ComponentProps<typeof Button>>
    >();
  });
});
