import type { Component, ComponentProps, Snippet } from 'svelte';
import type { EmptyObject, Simplify } from 'type-fest';
import { describe, expectTypeOf, it } from 'vitest';

import { defineMeta, type Args, type StoryContext } from '#index';
import type { Meta, StoryCmp, StoryContext as BaseStoryContext } from '#types';

import Button from '../examples/components/Button.svelte';

describe(defineMeta.name, () => {
  it('works when no meta entry "component" is provided', () => {
    const { Story, meta } = defineMeta({
      args: {
        sample: 0,
      },
    });

    expectTypeOf(Story).toMatchTypeOf<StoryCmp<EmptyObject, typeof meta>>();
    expectTypeOf(meta).toMatchTypeOf<Meta<{ sample: 0 }>>();
  });

  it('works with provided meta entry "component" entry', () => {
    const { Story, meta } = defineMeta({
      component: Button,
      args: {
        // FIXME: allow mapping snippets to primitives
        children: 'Click me' as unknown as Snippet,
      },
    });

    expectTypeOf(Button).toMatchTypeOf<Component<ComponentProps<Button>>>();
    expectTypeOf(Story).toMatchTypeOf<StoryCmp<EmptyObject, typeof meta>>();
  });
});

describe("type helper for snippets 'Args'", () => {
  const { Story, meta } = defineMeta({
    component: Button,
    args: {
      // FIXME: allow mapping snippets to primitives
      children: 'Click me' as unknown as Snippet,
    },
  });

  expectTypeOf<Args<typeof Story>>().toMatchTypeOf<(typeof meta)['args']>();
});

describe("type helper for snippets 'StoryContext'", () => {
  const { Story, meta } = defineMeta({
    component: Button,
    args: {
      // FIXME: allow mapping snippets to primitives
      children: 'Click me' as unknown as Snippet,
    },
  });

  expectTypeOf<StoryContext<typeof Story>>().toMatchTypeOf<
    BaseStoryContext<(typeof meta)['args']>
  >();
});

describe("component 'Story' destructured from 'defineMeta", () => {
  const { Story } = defineMeta({
    component: Button,
    args: {
      // FIXME: allow mapping snippets to primitives
      children: 'Click me' as unknown as Snippet,
    },
  });

  type TStoryProps = typeof Story extends __sveltets_2_IsomorphicComponent
    ? ComponentProps<typeof Story>
    : never;

  expectTypeOf<ComponentProps<Button>['children']>().not.toBeNullable();
  expectTypeOf<Meta<Button>['args']>().toBeNullable();
  expectTypeOf<NonNullable<Meta<Button>['args']>['children']>().toBeNullable();
  expectTypeOf<TStoryProps>().toHaveProperty('name');
  expectTypeOf<TStoryProps['name']>().not.toBeNullable();
  expectTypeOf<TStoryProps['args']>().toBeNullable();
  expectTypeOf<NonNullable<TStoryProps['args']>>().toHaveProperty('size');
  expectTypeOf<NonNullable<TStoryProps['args']>>().toHaveProperty('children');
  expectTypeOf<NonNullable<TStoryProps['args']>['children']>().toBeNullable();
});
