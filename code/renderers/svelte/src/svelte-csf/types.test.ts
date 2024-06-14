import type { ComponentAnnotations } from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import { describe, expectTypeOf, it } from 'vitest';

import Button from '../examples/components/Button.svelte';

import type { Meta, SvelteRenderer } from '#types';

describe('Meta', () => {
  it('Generic parameter of Meta can be a component', () => {
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
        /// Args
        ComponentProps<Button>
      >
    >();
  });

  it('Generic parameter of Meta can be the props of the component', () => {
    const meta = {
      component: Button,
      // FIXME: allow mapping snippets to primitives
      args: { children: 'good' as unknown as Snippet, disabled: false },
    } satisfies Meta<{ disabled: boolean; children: Snippet }>;

    expectTypeOf(meta).toMatchTypeOf<Meta<{ disabled: boolean; children: Snippet }>>();
    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<
        // Renderer
        SvelteRenderer<Component<{ disabled: boolean; children: Snippet }>>,
        // Args
        { disabled: boolean; children: Snippet }
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
    } satisfies Meta<Button>;

    expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
  });
});
