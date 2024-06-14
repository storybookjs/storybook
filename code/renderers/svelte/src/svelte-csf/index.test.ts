import type { Component, ComponentProps, Snippet } from 'svelte';
import type { EmptyObject } from 'type-fest';
import { describe, expectTypeOf, it } from 'vitest';

import { defineMeta } from '#index';

import type StoryCmp from './runtime/Story.svelte';

import Button from '../examples/components/Button.svelte';

describe(defineMeta.name, () => {
  it('works when no "component" entry is provided', ({ expect }) => {
    const { Story, meta } = defineMeta({
      args: {
        children: 'Click me',
      },
    });

    expectTypeOf(Story).toMatchTypeOf<typeof StoryCmp<EmptyObject, typeof meta>>();
  });

  it('works with provided "component" entry', ({ expect }) => {
    const { Story, meta } = defineMeta({
      component: Button,
      args: {
        children: 'Click me' as unknown as Snippet,
      },
    });

    const test = {
      component: Button,
    } as const;

    expectTypeOf(Button).toMatchTypeOf<Component<ComponentProps<Button>>>();
    expectTypeOf(Story).toMatchTypeOf<typeof StoryCmp<EmptyObject, typeof meta>>();
  });
});

describe.todo('type helper Args');

describe.todo('type helper StoryContext');
