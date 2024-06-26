import type { PlayFunctionContext } from '@storybook/types';
import type { Component, ComponentProps, Snippet } from 'svelte';
import type { EmptyObject, Primitive } from 'type-fest';
import { describe, expectTypeOf, it } from 'vitest';

import { defineMeta, type Args, type StoryContext } from '#index';
import type {
  Meta,
  StoryAnnotations,
  StoryCmp,
  StoryContext as BaseStoryContext,
  SvelteRenderer,
  MapSnippetsToAcceptPrimitives,
} from '#types';

import Button from '../examples/components/Button.svelte';

describe(defineMeta.name, () => {
  // it('works when no meta entry "component" is provided', () => {
  //   const { Story, meta } = defineMeta({
  //     args: {
  //       sample: 0,
  //     },
  //     play(context) {
  //       expectTypeOf(context).not.toBeAny();
  //       expectTypeOf(context).toMatchTypeOf<
  //         PlayFunctionContext<SvelteRenderer<Component<{ sample: 0 }>>>
  //       >();
  //       expectTypeOf(context.args).not.toBeAny();
  //       expectTypeOf(context.args).toMatchTypeOf<MapSnippetsToAcceptPrimitives<{ sample: 0 }>>();
  //     },
  //   });

  //   expectTypeOf(Story).toMatchTypeOf<StoryCmp<EmptyObject, { sample: 0 }, Meta<{ sample: 0 }>>>();
  //   expectTypeOf(meta).toMatchTypeOf<Meta<Component<{ sample: 0 }>>>();
  // });

  it('works with provided meta entry "component" entry', () => {
    const { Story, meta } = defineMeta({
      component: Button,
      args: {
        children: 'Click me',
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<PlayFunctionContext<SvelteRenderer<typeof Button>>>();
        expectTypeOf(context.args).toMatchTypeOf<
          MapSnippetsToAcceptPrimitives<ComponentProps<Button>>
        >();
      },
    });

    expectTypeOf(Story).toMatchTypeOf<StoryCmp<EmptyObject, typeof Button, Meta<typeof Button>>>();
    expectTypeOf(meta).toMatchTypeOf<Meta<typeof Button>>();
  });
});

describe("type helper for snippets 'Args'", () => {
  it("infers the type of entry 'args' from 'defineMeta' correctly", () => {
    const { Story } = defineMeta({
      component: Button,
      args: {
        children: 'Click me',
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<PlayFunctionContext<SvelteRenderer<typeof Button>>>();
        expectTypeOf(context.args).toMatchTypeOf<
          MapSnippetsToAcceptPrimitives<ComponentProps<Button>>
        >();
      },
    });
    expectTypeOf<Args<typeof Story>>().not.toBeNever();
    expectTypeOf<Args<typeof Story>>().not.toBeNullable();
    expectTypeOf<Args<typeof Story>>().toMatchTypeOf<
      StoryAnnotations<typeof Button, Meta<typeof Button>>['args']
    >();
    expectTypeOf<Args<typeof Story>['children']>().toMatchTypeOf<Snippet | Primitive>();
    expectTypeOf<Args<typeof Story>['children']>().toBeNullable();
  });
});

describe("type helper for snippets 'StoryContext'", () => {
  it("infers the type of entry 'args' from 'defineMeta' correctly", () => {
    const { Story, meta } = defineMeta({
      component: Button,
      args: {
        children: 'Click me',
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<PlayFunctionContext<SvelteRenderer<typeof Button>>>();
        expectTypeOf(context.args).toMatchTypeOf<
          MapSnippetsToAcceptPrimitives<ComponentProps<Button>>
        >();
      },
    });

    expectTypeOf<StoryContext<typeof Story>>().toMatchTypeOf<
      BaseStoryContext<typeof Button, typeof meta>
    >();
  });
});

describe("component 'Story' destructured from 'defineMeta", () => {
  it("creates valid types inside the 'args' attribute (prop)", () => {
    const { Story } = defineMeta({
      component: Button,
      args: {
        children: 'Click me',
      },
    });

    type TStoryProps = ComponentProps<typeof Story>;

    expectTypeOf(Story).toMatchTypeOf<StoryCmp<EmptyObject, typeof Button, Meta<typeof Button>>>();
    expectTypeOf<TStoryProps>().not.toBeNever();
    expectTypeOf<ComponentProps<Button>['children']>().not.toBeNullable();
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
