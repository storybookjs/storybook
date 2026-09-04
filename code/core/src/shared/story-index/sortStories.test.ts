import { expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { sortStoriesV7 } from './sortStories.ts';

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
