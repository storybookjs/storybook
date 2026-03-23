import { describe, expect, it } from 'vitest';

import { parseTagsParam, serializeTagsParam } from '../modules/tags';

describe('parseTagsParam', () => {
  it('returns empty arrays for falsy input', () => {
    expect(parseTagsParam(undefined)).toEqual({ included: [], excluded: [] });
    expect(parseTagsParam('')).toEqual({ included: [], excluded: [] });
  });

  it('parses include/exclude entries and maps known built-in URL tags', () => {
    expect(
      parseTagsParam(
        '$changed;$docs;$play;$test;custom;!blocked;!$changed;!$docs;!$play;!$test;!$unknown'
      )
    ).toEqual({
      included: ['_changed', '_docs', '_play', '_test', 'custom'],
      excluded: ['blocked', '_changed', '_docs', '_play', '_test', '$unknown'],
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
  it('returns undefined when no tags are provided', () => {
    expect(serializeTagsParam([], [])).toBeUndefined();
  });

  it('serializes include/exclude entries and maps known built-in internal tags', () => {
    expect(
      serializeTagsParam(
        ['_changed', '_docs', '_play', '_test', 'custom', '_unknown'],
        ['blocked', '_changed', '_docs', '_play', '_test', '_unknown']
      )
    ).toEqual(
      '$changed;$docs;$play;$test;custom;_unknown;!blocked;!$changed;!$docs;!$play;!$test;!_unknown'
    );
  });
});
