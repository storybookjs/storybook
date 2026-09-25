import { describe, it } from 'vitest';
import { definePreview } from './index.ts';

describe('definePreview', () => {
  it('supports strict set of tags with autocompletion', () => {
    const preview = definePreview({
      addons: [],
    }).type<{ tags: Array<'foo' | 'bar'> }>();

    const meta = preview.meta({});

    const _story = meta.story({
      tags: ['foo', 'bar'],
    });

    // @ts-expect-error - bad tags
    const _badStory = meta.story({
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

    const _story = meta.story({
      tags: ['bar', 'cat'],
    });
  });
});
