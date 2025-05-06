/**
 * @vitest-environment happy-dom
 */

import { createRawSnippet, mount, type ComponentProps, type Snippet } from 'svelte';
import type { StoryContext as StorybookStoryContext } from 'storybook/internal/types';
import { describe, expectTypeOf, it } from 'vitest';

import StoryComponent from './runtime/Story.svelte';

import { defineMeta, type StoryContext } from './index.js';
import type {
  StoryAnnotations,
  StoryContext as BaseStoryContext,
  SvelteRenderer,
} from '$lib/types.js';

import Button from '../examples/components/Button.svelte';

describe(defineMeta.name, () => {
  it('works with provided meta entry "component" entry', () => {
    const { Story } = defineMeta({
      component: Button,
      args: {
        children: createRawSnippet(() => ({
          render: () => 'Click me',
        })),
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<StorybookStoryContext<SvelteRenderer<typeof Button>>>();
      },
    });

    expectTypeOf(Story).toMatchTypeOf<
      typeof StoryComponent<ComponentProps<typeof Button>, typeof Button>
    >();
  });
});

describe("component 'Story' destructured from 'defineMeta", () => {
  it("creates valid types inside the 'args' attribute (prop)", () => {
    const { Story } = defineMeta({
      component: Button,
      args: {
        children: createRawSnippet(() => ({
          render: () => 'Click me',
        })),
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<StorybookStoryContext<SvelteRenderer<typeof Button>>>();
      },
    });

    type TStoryProps = ComponentProps<typeof Story>;

    expectTypeOf<TStoryProps>().not.toBeNever();
    expectTypeOf<TStoryProps['name']>().toBeNullable();
    expectTypeOf<TStoryProps['exportName']>().toBeNullable();
    expectTypeOf<TStoryProps['play']>().toBeNullable();
    expectTypeOf<TStoryProps['args']>().toBeNullable();
    expectTypeOf<NonNullable<TStoryProps['args']>>().toMatchTypeOf<
      Partial<ComponentProps<typeof Button>>
    >();
  });
});
