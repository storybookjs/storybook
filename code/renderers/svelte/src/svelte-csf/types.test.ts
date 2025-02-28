import type { StoryContext } from 'storybook/internal/types';
import { createRawSnippet, type Component } from 'svelte';
import { describe, expectTypeOf, it } from 'vitest';

import type { Meta, SvelteRenderer, ComponentAnnotations } from '$lib/types.js';

import Button from '../examples/components/Button.svelte';

describe('Meta', () => {
  it(`works correctly when no 'meta.component' entry provided`, () => {
    const meta = {
      args: {
        sample: 0,
      },
    } satisfies Meta<Component<{ sample: 0 }>>;

    expectTypeOf(meta).toMatchTypeOf<Meta<Component<{ sample: 0 }>>>();
    expectTypeOf(meta).toMatchTypeOf<ComponentAnnotations<Component<{ sample?: 0 }>>>();
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
    } satisfies Meta<typeof Button>;

    expectTypeOf(meta).toMatchTypeOf<Meta<typeof Button>>();
    expectTypeOf(meta).toMatchTypeOf<ComponentAnnotations<typeof Button>>();
  });
});
