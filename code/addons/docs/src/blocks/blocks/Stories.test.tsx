// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { PreparedStory } from 'storybook/internal/types';

import type { DocsContextProps } from './DocsContext.ts';
import { DocsContext } from './DocsContext.ts';
import { Stories } from './Stories.tsx';

// The list of stories, without the theme and the docs context each story's blocks need.
vi.mock('./DocsStory', () => ({
  DocsStory: ({ of }: { of: { id: string } }) => <div data-testid="story">{of.id}</div>,
}));
vi.mock('./Heading', () => ({ Heading: () => null }));

const storyNamed = (id: string, inline: boolean) =>
  ({
    id,
    name: id,
    tags: ['autodocs'],
    moduleExport: { id },
    parameters: { docs: { story: { inline } } },
  }) as unknown as PreparedStory;

const listedStories = (stories: PreparedStory[], element = <Stories />) => {
  const context = {
    componentStories: () => stories,
    projectAnnotations: { parameters: {} },
    getStoryContext: vi.fn(),
    filterByAutodocs: true,
  } as unknown as DocsContextProps;
  const { queryAllByTestId } = render(
    <DocsContext.Provider value={context}>{element}</DocsContext.Provider>
  );
  return queryAllByTestId('story').map((story) => story.textContent);
};

afterEach(() => cleanup());

describe('Stories', () => {
  it('lists the primary story again when it renders inline', () => {
    expect(listedStories([storyNamed('a', true), storyNamed('b', true)])).toEqual(['a', 'b']);
  });

  it('skips the primary story when it renders in an iframe, as the Primary block shows it', () => {
    expect(listedStories([storyNamed('a', false), storyNamed('b', false)])).toEqual(['b']);
  });

  it('lists the primary story in an iframe when includePrimary is set', () => {
    expect(
      listedStories([storyNamed('a', false), storyNamed('b', false)], <Stories includePrimary />)
    ).toEqual(['a', 'b']);
  });

  it('skips the first story with includePrimary={false}, inline or not', () => {
    expect(
      listedStories(
        [storyNamed('a', true), storyNamed('b', true)],
        <Stories includePrimary={false} />
      )
    ).toEqual(['b']);
  });
});
