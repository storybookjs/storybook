import { describe, expect, it } from 'vitest';

import { computeStaticFilterFn, parseTagsParam, serializeTagsParam } from '../modules/tags';

describe('computeStaticFilterFn', () => {
  const filter = computeStaticFilterFn({});

  it('shows stories with dev tag and hides stories without dev', () => {
    expect(filter({ id: 's1', type: 'story', tags: ['dev'] })).toBe(true);
    expect(filter({ id: 's2', type: 'story', tags: ['test'] })).toBe(false);
  });

  it('hides MDX docs without dev tag (respects !dev on Meta)', () => {
    expect(
      filter({
        id: 'd1',
        type: 'docs',
        tags: ['unattached-mdx', 'manifest'],
      })
    ).toBe(false);
    expect(
      filter({
        id: 'd2',
        type: 'docs',
        tags: ['attached-mdx', 'manifest'],
      })
    ).toBe(false);
    expect(
      filter({
        id: 'd3',
        type: 'docs',
        tags: ['unattached-mdx', 'dev', 'manifest'],
      })
    ).toBe(true);
    expect(
      filter({
        id: 'd4',
        type: 'docs',
        tags: ['attached-mdx', 'dev', 'manifest'],
      })
    ).toBe(true);
  });

  it('shows autodocs with dev tag and hides autodocs without dev', () => {
    expect(
      filter({
        id: 'core-tags-add--docs',
        type: 'docs',
        tags: ['dev', 'manifest', 'autodocs'],
      })
    ).toBe(true);
    expect(
      filter({
        id: 'core-tags-add--docs',
        type: 'docs',
        tags: ['manifest', 'autodocs'],
      })
    ).toBe(false);
  });

  it('hides entries that carry a tag marked hideFromSidebar', () => {
    const filterWithExclude = computeStaticFilterFn({
      dev: { hideFromSidebar: true },
    });
    expect(filterWithExclude({ id: 's1', type: 'story', tags: ['dev'] })).toBe(false);
  });
});

describe('parseTagsParam', () => {
  it('returns empty arrays for falsy input', () => {
    expect(parseTagsParam(undefined)).toEqual({ included: [], excluded: [] });
    expect(parseTagsParam('')).toEqual({ included: [], excluded: [] });
  });

  it('parses include/exclude entries and maps known built-in URL tags', () => {
    expect(
      parseTagsParam('$docs;$play;$test;custom;!blocked;!$docs;!$play;!$test;!$unknown')
    ).toEqual({
      included: ['_docs', '_play', '_test', 'custom'],
      excluded: ['blocked', '_docs', '_play', '_test', '$unknown'],
    });
  });

  it('ignores empty segments between separators', () => {
    expect(parseTagsParam('a;;!b;;;')).toEqual({
      included: ['a'],
      excluded: ['b'],
    });
  });
});

describe('serializeTagsParam', () => {
  it('returns empty string when no tags are provided', () => {
    expect(serializeTagsParam([], [])).toBe('');
  });

  it('serializes include/exclude entries and maps known built-in internal tags', () => {
    expect(
      serializeTagsParam(
        ['_play', '_docs', '_test', 'custom', '_unknown'],
        ['blocked', '_docs', '_play', '_test', '_unknown']
      )
    ).toEqual('$docs;$play;$test;_unknown;custom;!$docs;!$play;!$test;!_unknown;!blocked');
  });
});
