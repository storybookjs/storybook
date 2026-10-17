import { describe, expectTypeOf, it } from 'vitest';

import type { StoryAnnotations } from 'storybook/internal/types';

import type { ReactMeta } from '@storybook/react';
import { definePreview } from './index.ts';

describe('definePreview', () => {
  it('supports strict set of tags with autocompletion', () => {
    const preview = definePreview({
      addons: [],
    }).type<{ tags: Array<'foo' | 'bar'> }>();

    const meta = preview.meta({});

    meta.story({
      tags: ['foo', 'bar'],
    });

    // @ts-expect-error - bad tags
    meta.story({
      tags: ['baz', 'qux'],
    });
  });
  it('supports extensible tags with autocompletion', () => {
    const preview = definePreview({
      addons: [],
    }).type<{ tags: Array<'foo' | 'bar' | (string & {})> }>();

    const meta = preview.meta({
      tags: ['foo', 'dog'],
    });

    meta.story({
      tags: ['bar', 'cat'],
    });

    expectTypeOf<StoryTags<typeof meta>>().toEqualTypeOf<
      Array<'foo' | 'bar' | (string & {})> | undefined
    >();
  });
});

/** The `tags` type a story of this meta accepts. */
type StoryTags<M> =
  M extends ReactMeta<infer T, any> ? StoryAnnotations<T, T['args']>['tags'] : never;
