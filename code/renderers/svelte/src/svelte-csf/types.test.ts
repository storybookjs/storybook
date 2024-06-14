import type { ComponentAnnotations } from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import { describe, expectTypeOf, it } from 'vitest';

import Button from '../examples/components/Button.svelte';

import type { Meta, SvelteRenderer } from '#types';

describe('Meta', () => {
  it('Generic parameter of Meta can be a component', () => {
    const meta: Meta<typeof Button> = {
      component: Button,
      args: {
        children: 'good' as unknown as Snippet,
        disabled: false,
      },
    };

    expectTypeOf(meta).toEqualTypeOf<
      ComponentAnnotations<
        // Renderer
        SvelteRenderer<typeof Button>,
        /// Args
        ComponentProps<Button>
      >
    >();
  });

  it('Generic parameter of Meta can be the props of the component', () => {
    const meta: Meta<{ disabled: boolean; children: Snippet }> = {
      component: Button,
      args: { children: 'good' as unknown as Snippet, disabled: false },
    };

    expectTypeOf(meta).toEqualTypeOf<
      ComponentAnnotations<
        // Renderer
        SvelteRenderer<{ disabled: boolean; children: Snippet }>,
        // Args
        { disabled: boolean; children: Snippet }
      >
    >();
  });

  it('Events are inferred from component', () => {
    const meta: Meta<typeof Button> = {
      component: Button,
      args: {
        children: 'good' as unknown as Snippet,
        disabled: false,
        onclick: (event) => {
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
    };

    expectTypeOf(meta).toMatchTypeOf<Meta<typeof Button>>();
  });

  // FIXME: Verify if this still needs to be tested, after Svelte v5
  // it("Events fallback to custom events when no component is specified", () => {
  // 	const meta: Meta<{ disabled: boolean; label: string }> = {
  // 		component: Button,
  // 		args: { label: "good", disabled: false },
  // 		render: (args) => ({
  // 			Component: Button,
  // 			props: args,
  // 			on: {
  // 				mousemove: (event) => {
  // 					expectTypeOf(event).toEqualTypeOf<CustomEvent>();
  // 				},
  // 			},
  // 		}),
  // 	};
  // 	expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
  // });
});
