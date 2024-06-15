import type { ComponentAnnotations, PlayFunctionContext } from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import { describe, expectTypeOf, it } from 'vitest';

import type { Meta, SvelteRenderer } from '#types';

import Button from '../examples/components/Button.svelte';

describe('Meta', () => {
  it(`works correctly when no 'meta.component' entry provided`, () => {
    const meta = {
      args: {
        sample: 0,
      },
    } satisfies Meta<{ sample: 0 }>;

    expectTypeOf(meta).toMatchTypeOf<Meta<{ sample: 0 }>>();
    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<
        // Renderer
        SvelteRenderer<Component<{ sample: 0 }>>,
        // Args
        { sample: 0 }
      >
    >();
  });

  it('generic parameter can be a component', () => {
    const meta = {
      component: Button,
      args: {
        // FIXME: allow mapping snippets to primitives
        children: 'good' as unknown as Snippet,
        disabled: false,
      },
    } satisfies Meta<Button>;

    expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<
        // Renderer
        SvelteRenderer<Button>,
        // Args
        ComponentProps<Button>
      >
    >();
  });

  it('generic parameter can be the props of the component', () => {
    const meta = {
      component: Button,
      // FIXME: allow mapping snippets to primitives
      args: {
        children: 'good' as unknown as Snippet,
        disabled: false,
      },
    } satisfies Meta<ComponentProps<Button>>;

    expectTypeOf(meta).toMatchTypeOf<Meta<ComponentProps<Button>>>();
    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<
        // Renderer
        SvelteRenderer<ComponentProps<Button>>,
        // Args
        ComponentProps<Button>
      >
    >();
  });

  it('Events are inferred from component', () => {
    const meta = {
      component: Button,
      args: {
        disabled: false,
        onclick: (event) => {
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play: (context) => {
        expectTypeOf(context).toMatchTypeOf<PlayFunctionContext<SvelteRenderer<Button>>>();
      },
    } satisfies Meta<Button>;

    expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
  });
});
