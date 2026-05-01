import { describe, expect, it } from 'vitest';

import { parseTagsParam, serializeTagsParam } from '../modules/tags';

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
