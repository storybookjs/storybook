// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { Channel } from 'storybook/internal/channels';
import type { CSFFile, PreparedStory, Renderer } from 'storybook/internal/types';

import { DocsContext as DocsContextImpl } from 'storybook/preview-api';

import { DocsContext } from './DocsContext.ts';
import { Story, getStoryProps } from './Story.tsx';

type Store = ConstructorParameters<typeof DocsContextImpl<Renderer>>[1];
const storyExport = {};
const story = {
  id: 'other-package--story',
  name: 'Story',
  moduleExport: storyExport,
  parameters: { docs: { story: { inline: true } } },
} as unknown as PreparedStory;
const csfFile = {
  meta: { id: 'other-package', title: 'Other Package' },
  stories: { [story.id]: { id: story.id, moduleExport: storyExport } },
  moduleExports: { Story: storyExport },
} as unknown as CSFFile;

afterEach(() => cleanup());

it('renders a story by id whose CSF file the docs entry does not import', async () => {
  const store = {
    loadCSFFileByStoryId: async () => csfFile,
    storyFromCSFFile: () => story,
    componentStoriesFromCSFFile: () => [story],
  };
  const renderStoryToElement = vi.fn(() => async () => {});
  const context = new DocsContextImpl<Renderer>(
    new Channel({}),
    store as unknown as Store,
    renderStoryToElement,
    []
  );

  render(
    <DocsContext.Provider value={context}>
      <Story id="other-package--story" />
    </DocsContext.Provider>
  );

  await waitFor(() =>
    expect(renderStoryToElement).toHaveBeenCalledWith(
      story,
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  );
});

it('throws when a story is referenced with both `of` and `id`', () => {
  const context = new DocsContextImpl<Renderer>(new Channel({}), {} as Store, vi.fn(), []);
  vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() =>
    render(
      <DocsContext.Provider value={context}>
        <Story of={storyExport} id="other-package--story" />
      </DocsContext.Provider>
    )
  ).toThrow(/not with both/);
});

it('throws the load error of an id that names no story', async () => {
  const notFound = new Error("Couldn't find story matching id 'no-such--story'");
  const store = {
    loadCSFFileByStoryId: async () => {
      throw notFound;
    },
  };
  const context = new DocsContextImpl<Renderer>(
    new Channel({}),
    store as unknown as Store,
    vi.fn(),
    []
  );
  const onError = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});

  class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
      return { failed: true };
    }

    componentDidCatch(error: unknown) {
      onError(error);
    }

    render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  render(
    <Boundary>
      <DocsContext.Provider value={context}>
        <Story id="no-such--story" />
      </DocsContext.Provider>
    </Boundary>
  );

  await waitFor(() => expect(onError).toHaveBeenCalledWith(notFound));
});

describe('a story that owns the document', () => {
  const context = {} as Parameters<typeof getStoryProps>[2];
  const documentStory = (docsStory: Record<string, unknown> = {}) =>
    ({
      ...story,
      parameters: { layout: 'document', docs: { story: { inline: true, ...docsStory } } },
    }) as unknown as PreparedStory;

  it('renders in an iframe, also where the project and the block render inline', () => {
    expect(getStoryProps({}, documentStory(), context).inline).toBe(false);
    expect(getStoryProps({ inline: true }, documentStory(), context).inline).toBe(false);
  });

  it('is as tall as a small phone by default', () => {
    expect(getStoryProps({}, documentStory(), context).height).toBe('667px');
  });

  it('takes the height of its parameters and of the block', () => {
    expect(getStoryProps({}, documentStory({ height: '900px' }), context).height).toBe('900px');
    expect(getStoryProps({ height: '400px' }, documentStory(), context).height).toBe('400px');
  });
});
