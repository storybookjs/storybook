import type { StoryContext as StorybookStoryContext } from '@storybook/types';
import { createRawSnippet, type ComponentProps, type Snippet } from 'svelte';
import type { Primitive } from 'type-fest';
import { describe, expectTypeOf, it } from 'vitest';

import StoryComponent from './runtime/Story.svelte';

import { defineMeta, type Args, type StoryContext } from './index';
import type {
  Meta,
  StoryAnnotations,
  StoryContext as BaseStoryContext,
  SvelteRenderer,
} from '$lib/types';

import Button from '../examples/components/Button.svelte';

describe(defineMeta.name, () => {
  it('works with provided meta entry "component" entry', () => {
    const { Story, meta } = defineMeta({
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

    expectTypeOf(Story).toMatchTypeOf<typeof StoryComponent<typeof Button>>();
    expectTypeOf(meta).toMatchTypeOf<Meta<typeof Button>>();
  });
});

describe("type helper for snippets 'Args'", () => {
  it("infers the type of entry 'args' from 'defineMeta' correctly", () => {
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
    expectTypeOf<Args<typeof Story>>().not.toBeNever();
    expectTypeOf<Args<typeof Story>>().not.toBeNullable();
    expectTypeOf<Args<typeof Story>>().toMatchTypeOf<StoryAnnotations<typeof Button>['args']>();
    expectTypeOf<Args<typeof Story>['children']>().toMatchTypeOf<Snippet | Primitive>();
    expectTypeOf<Args<typeof Story>['children']>().toBeNullable();
  });
});

describe("type helper for snippets 'StoryContext'", () => {
  it("infers the type of entry 'args' from 'defineMeta' correctly", () => {
    const { Story, meta } = defineMeta({
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

    expectTypeOf<StoryContext<typeof Story>>().toMatchTypeOf<BaseStoryContext<typeof Button>>();
    expectTypeOf(meta).toMatchTypeOf<Meta<typeof Button>>();
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
      },
    });

    type TStoryProps = ComponentProps<typeof Story>;

    expectTypeOf(Story).toMatchTypeOf<typeof StoryComponent<typeof Button>>();
    expectTypeOf<TStoryProps>().not.toBeNever();
    expectTypeOf<Meta<typeof Button>['args']>().toBeNullable();
    expectTypeOf<NonNullable<Meta<typeof Button>['args']>['children']>().toBeNullable();
    expectTypeOf<TStoryProps>().toHaveProperty('name');
    expectTypeOf<TStoryProps['name']>().toBeNullable();
    expectTypeOf<TStoryProps['exportName']>().toBeNullable();
    expectTypeOf<TStoryProps['args']>().toBeNullable();
    expectTypeOf<NonNullable<TStoryProps['args']>>().toHaveProperty('size');
    expectTypeOf<NonNullable<TStoryProps['args']>>().toHaveProperty('children');
    expectTypeOf<NonNullable<TStoryProps['args']>['children']>().toBeNullable();
    expectTypeOf<TStoryProps['play']>().toBeNullable();
  });
});
