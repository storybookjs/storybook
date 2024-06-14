import type { Component, ComponentProps, Snippet } from 'svelte';
import type { EmptyObject } from 'type-fest';
import { describe, expectTypeOf, it } from 'vitest';

import { defineMeta } from '#index';

import type StoryCmp from './runtime/Story.svelte';

import Button from '../examples/components/Button.svelte';
import type { Meta } from '#types';

describe(defineMeta.name, () => {
  it('works when no "component" entry is provided', () => {
    const { Story, meta } = defineMeta({
      args: {
        children: 'Click me',
      },
    });

    expectTypeOf(Story).toMatchTypeOf<typeof StoryCmp<EmptyObject, typeof meta>>();
  });

  it('works with provided "component" entry', () => {
    const { Story, meta } = defineMeta<EmptyObject, Meta<Button>>({
      component: Button,
      args: {
        // FIXME: allow mapping snippets to primitives
        children: 'Click me' as unknown as Snippet,
      },
    });

    expectTypeOf(Button).toMatchTypeOf<Component<ComponentProps<Button>>>();
    expectTypeOf(Story).toMatchTypeOf<typeof StoryCmp<EmptyObject, Meta<Button>>>();
  });
});

describe.todo('type helper Args');

describe.todo('type helper StoryContext');
