import type { PlayFunctionContext } from '@storybook/types';
import type { Component, ComponentProps } from 'svelte';
import { describe, expectTypeOf, it } from 'vitest';

import type { Meta, SvelteRenderer, ComponentAnnotations, SvelteStoryResult } from '#types';

import Button from '../examples/components/Button.svelte';
import type { Simplify } from 'type-fest';

describe('Meta', () => {
  it(`works correctly when no 'meta.component' entry provided`, () => {
    const meta = {
      args: {
        sample: 0,
      },
    } satisfies Meta<{ sample: 0 }>;

    expectTypeOf(meta).toMatchTypeOf<Meta<{ sample: 0 }>>();
    expectTypeOf(meta).toMatchTypeOf<ComponentAnnotations<{ sample?: 0 }>>();
  });

  it('generic parameter can be a component', () => {
    const meta = {
      component: Button,
      args: {
        children: 'good',
        disabled: false,
      },
    } satisfies Meta<Button>;

    type XCA = ComponentAnnotations<Button>['args'];
    type XR = SvelteRenderer<Button>;
    type XSR = SvelteStoryResult<Button>;
    type Z = XSR['props'];

    type TMeta = Simplify<typeof meta>;

    expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
    expectTypeOf(meta).toMatchTypeOf<ComponentAnnotations<ComponentProps<Button>>>();
  });
  it('generic parameter can be the props of the component', () => {
    const meta = {
      component: Button,
      args: {
        children: 'good',
        disabled: false,
        onclick: (event) => {
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
    } satisfies Meta<ComponentProps<Button>>;

    expectTypeOf(meta).toMatchTypeOf<Meta<ComponentProps<Button>>>();
    expectTypeOf(meta).toMatchTypeOf<ComponentAnnotations<ComponentProps<Button>>>();
  });

  it('Events are inferred from component', () => {
    const meta = {
      component: Button,
      args: {
        disabled: false,
        children: 'good',
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
