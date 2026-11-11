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

it('treats a sorter that returns nothing as considering the stories equal', () => {
  const stories = [
    { id: 'b--one', title: 'B', name: 'One' },
    { id: 'intro--one', title: 'Intro', name: 'One' },
    { id: 'a--one', title: 'A', name: 'One' },
  ] as IndexEntry[];
  // @ts-expect-error A sorter written without strict return checks may return undefined.
  const pinIntro: (a: IndexEntry, b: IndexEntry) => number = (a, b) => {
    if (a.title === 'Intro') {
      return -1;
    }
    if (b.title === 'Intro') {
      return 1;
    }
  };

  const sorted = sortStoriesV7(
    stories,
    combineStorySorts([pinIntro, { method: 'alphabetical' }]),
    []
  );

  expect(sorted.map(({ id }) => id)).toEqual(['intro--one', 'a--one', 'b--one']);
});
