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

const byKindTitles = ['Intro', 'Components', 'Components / Button', 'Alpha', 'Zeta / Inner'];

const toEntries = (titles: string[]) =>
  titles.map((title) => ({ id: title, title, name: 'Default' })) as IndexEntry[];

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
          item,
          ...rest,
        ])
      );

it('sorts folders first with order in the same alphabetical-by-kind sorter', () => {
  const sorted = sortStoriesV7(
    toEntries(byKindTitles),
    combineStorySorts([{ method: 'alphabetical-by-kind', order: ['Intro'] }]),
    []
  );

  expect(sorted.map(({ title }) => title)).toEqual([
    'Intro',
    'Components / Button',
    'Zeta / Inner',
    'Alpha',
    'Components',
  ]);
});

it('gives one alphabetical-by-kind order whatever the input order', () => {
  const results = new Set(
    permutations(byKindTitles).map((titles) =>
      sortStoriesV7(
        toEntries(titles),
        combineStorySorts([{ method: 'alphabetical-by-kind', order: ['Intro'] }]),
        []
      )
        .map(({ title }) => title)
        .join(',')
    )
  );

  expect(results).toEqual(new Set(['Intro,Components / Button,Zeta / Inner,Alpha,Components']));
});

it('places unlisted titles at the wildcard with alphabetical-by-kind', () => {
  const sorted = sortStoriesV7(
    toEntries(byKindTitles),
    combineStorySorts([{ method: 'alphabetical-by-kind', order: ['Intro', '*', 'Alpha'] }]),
    []
  );

  expect(sorted.map(({ title }) => title)).toEqual([
    'Intro',
    'Components / Button',
    'Zeta / Inner',
    'Components',
    'Alpha',
  ]);
});
