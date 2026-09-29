import { expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { combineStorySorts, sortStoriesV7 } from './sortStories.ts';

it('uses a top-level array as the story order', () => {
  const stories = [
    { id: 'components--button', title: 'Components' },
    { id: 'intro--welcome', title: 'Intro' },
  ] as IndexEntry[];

  expect(sortStoriesV7(stories, ['Intro', 'Components'], [])).toEqual([
    expect.objectContaining({ id: 'intro--welcome' }),
    expect.objectContaining({ id: 'components--button' }),
  ]);
});

it('lets each sorter break the ties of the sorters before it', () => {
  const stories = [
    { id: 'b--second', title: 'B', name: 'Second' },
    { id: 'a--second', title: 'A', name: 'Second' },
    { id: 'a--first', title: 'A', name: 'First' },
  ] as IndexEntry[];
  const byTitle = (a: IndexEntry, b: IndexEntry) => a.title.localeCompare(b.title);

  const sorted = sortStoriesV7(
    stories,
    combineStorySorts([byTitle, { method: 'alphabetical', includeNames: true }]),
    []
  );

  expect(sorted.map(({ id }) => id)).toEqual(['a--first', 'a--second', 'b--second']);
});

it('passes a single sorter through and leaves an empty list to the file order', () => {
  const byTitle = (a: IndexEntry, b: IndexEntry) => a.title.localeCompare(b.title);

  expect(combineStorySorts([byTitle])).toBe(byTitle);
  expect(combineStorySorts([])).toBeUndefined();
});
