import { describe, expect, it } from 'vite-plus/test';

import { combineTags, isExportStory, storyNameFromExport, toId } from './index';

describe('toId', () => {
  const testCases: [string, string, string | undefined, string][] = [
    // name, kind, story, output
    ['handles simple cases', 'kind', 'story', 'kind--story'],
    ['handles kind without story', 'kind', undefined, 'kind'],
    ['handles basic substitution', 'a b$c?d😀e', '1-2:3', 'a-b-c-d😀e--1-2-3'],
    ['handles runs of non-url chars', 'a?&*b', 'story', 'a-b--story'],
    ['removes non-url chars from start and end', '?ab-', 'story', 'ab--story'],
    ['downcases', 'KIND', 'STORY', 'kind--story'],
    ['non-latin', 'Кнопки', 'нормальный', 'кнопки--нормальный'],
    ['korean', 'kind', '바보 (babo)', 'kind--바보-babo'],
    ['all punctuation', 'kind', 'unicorns,’–—―′¿`"<>()!.!!!{}[]%^&$*#&', 'kind--unicorns'],
  ];

  testCases.forEach(([name, kind, story, output]) => {
    it(name, () => {
      expect(toId(kind, story)).toBe(output);
    });
  });

  it('does not allow kind with *no* url chars', () => {
    expect(() => toId('?', 'asdf')).toThrow(
      `Invalid kind '?', must include alphanumeric characters`
    );
  });

  it('does not allow empty kind', () => {
    expect(() => toId('', 'asdf')).toThrow(`Invalid kind '', must include alphanumeric characters`);
  });

  it('does not allow story with *no* url chars', () => {
    expect(() => toId('kind', '?')).toThrow(
      `Invalid name '?', must include alphanumeric characters`
    );
  });

  it('allows empty story', () => {
    expect(() => toId('kind', '')).not.toThrow();
  });
});

describe('storyNameFromExport', () => {
  it('should format CSF exports with sensible defaults', () => {
    const testCases = {
      name: 'Name',
      someName: 'Some Name',
      someNAME: 'Some NAME',
      some_custom_NAME: 'Some Custom NAME',
      someName1234: 'Some Name 1234',
      someName1_2_3_4: 'Some Name 1 2 3 4',
    };
    Object.entries(testCases).forEach(([key, val]) => expect(storyNameFromExport(key)).toBe(val));
  });
});

describe('isExportStory', () => {
  it('should exclude __esModule', () => {
    expect(isExportStory('__esModule', {})).toBeFalsy();
  });

  it('should include all stories when there are no filters', () => {
    expect(isExportStory('a', {})).toBeTruthy();
  });

  it('should filter stories by arrays', () => {
    expect(isExportStory('a', { includeStories: ['a'] })).toBeTruthy();
    expect(isExportStory('a', { includeStories: [] })).toBeFalsy();
    expect(isExportStory('a', { includeStories: ['b'] })).toBeFalsy();

    expect(isExportStory('a', { excludeStories: ['a'] })).toBeFalsy();
    expect(isExportStory('a', { excludeStories: [] })).toBeTruthy();
    expect(isExportStory('a', { excludeStories: ['b'] })).toBeTruthy();

    expect(isExportStory('a', { includeStories: ['a'], excludeStories: ['a'] })).toBeFalsy();
    expect(isExportStory('a', { includeStories: [], excludeStories: [] })).toBeFalsy();
    expect(isExportStory('a', { includeStories: ['a'], excludeStories: ['b'] })).toBeTruthy();
  });

  it('should filter stories by regex', () => {
    expect(isExportStory('a', { includeStories: /a/ })).toBeTruthy();
    expect(isExportStory('a', { includeStories: /.*/ })).toBeTruthy();
    expect(isExportStory('a', { includeStories: /b/ })).toBeFalsy();

    expect(isExportStory('a', { excludeStories: /a/ })).toBeFalsy();
    expect(isExportStory('a', { excludeStories: /.*/ })).toBeFalsy();
    expect(isExportStory('a', { excludeStories: /b/ })).toBeTruthy();

    expect(isExportStory('a', { includeStories: /a/, excludeStories: ['a'] })).toBeFalsy();
    expect(isExportStory('a', { includeStories: /.*/, excludeStories: /.*/ })).toBeFalsy();
    expect(isExportStory('a', { includeStories: /a/, excludeStories: /b/ })).toBeTruthy();
  });
});

describe('combineTags', () => {
  it.each([
    [[], []],
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    [
      ['a', 'b', 'b'],
      ['a', 'b'],
    ],
    [['a', 'b', '!b'], ['a']],
    [['b', '!b', 'b'], ['b']],
  ])('combineTags(%o) -> %o', (tags, expected) => {
    expect(combineTags(...tags)).toEqual(expected);
  });
});
