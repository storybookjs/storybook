// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

const storyNamed = (id: string, inline: boolean, extra: Partial<PreparedStory> = {}) =>
  ({
    id,
    name: id,
    tags: ['autodocs'],
    moduleExport: { id },
    parameters: { docs: { story: { inline } } },
    ...extra,
  }) as unknown as PreparedStory;

const listedStories = (
  stories: PreparedStory[],
  { element = <Stories />, filterByAutodocs = true } = {}
) => {
  const context = {
    componentStories: () => stories,
    projectAnnotations: { parameters: {} },
    getStoryContext: vi.fn(),
    filterByAutodocs,
  } as unknown as DocsContextProps;
  const { queryAllByTestId, unmount } = render(
    <DocsContext.Provider value={context}>{element}</DocsContext.Provider>
  );
  const listed = queryAllByTestId('story').map((story) => story.textContent);
  unmount();
  return listed;
};

describe('Stories', () => {
  it('lists the primary story again when it renders inline', () => {
    expect(listedStories([storyNamed('a', true), storyNamed('b', true)])).toEqual(['a', 'b']);
  });

  it('leaves out the primary story on an autodocs page when it renders in an iframe', () => {
    expect(listedStories([storyNamed('a', false), storyNamed('b', false)])).toEqual(['b']);
  });

  it('leaves out only the primary story, also when it is not the first one listed', () => {
    // A story that mounts in its play is not listed, but the Primary block shows it.
    const primary = storyNamed('a', false, { usesMount: true });
    expect(listedStories([primary, storyNamed('b', false), storyNamed('c', false)])).toEqual([
      'b',
      'c',
    ]);
  });

  it('lists every story in an MDX file, which may have no Primary block', () => {
    expect(
      listedStories([storyNamed('a', false), storyNamed('b', false)], { filterByAutodocs: false })
    ).toEqual(['a', 'b']);
  });

  it('lists the primary story in an iframe when includePrimary is set', () => {
    expect(
      listedStories([storyNamed('a', false), storyNamed('b', false)], {
        element: <Stories includePrimary />,
      })
    ).toEqual(['a', 'b']);
  });

  it('drops the first story with includePrimary={false}, inline or in an iframe', () => {
    const element = <Stories includePrimary={false} />;
    expect(listedStories([storyNamed('a', true), storyNamed('b', true)], { element })).toEqual([
      'b',
    ]);
    expect(listedStories([storyNamed('a', false), storyNamed('b', false)], { element })).toEqual([
      'b',
    ]);
  });
});
