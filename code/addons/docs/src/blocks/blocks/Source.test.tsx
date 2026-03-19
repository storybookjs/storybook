// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import React, { memo } from 'react';

import type { PreparedStory } from 'storybook/internal/types';

import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { Source } from './Source';
import { SourceContext, argsHash } from './SourceContainer';

const pureSourceSpy = vi.fn();

vi.mock('../components/Source', () => ({
  Source: (props: unknown) => {
    pureSourceSpy(props);
    return null;
  },
  SourceError: {
    NO_STORY: 'There’s no story here.',
    SOURCE_UNAVAILABLE: 'Oh no! The source is not available.',
  },
}));

const StaticSource = memo(function StaticSource() {
  return <Source code={`<some>html</some>`} />;
});

const StorySource = memo(function StorySource() {
  return <Source />;
});

const createMockDocsContext = (story?: Partial<PreparedStory>) =>
  ({
    storyById: vi.fn(() => {
      if (!story) {
        throw new Error('No attached story');
      }

      return story;
    }),
    getStoryContext: vi.fn(() => ({
      id: story?.id,
      initialArgs: {},
      unmappedArgs: {},
      parameters: story?.parameters ?? {},
    })),
  }) as Partial<DocsContextProps> as DocsContextProps;

describe('Source', () => {
  beforeEach(() => {
    pureSourceSpy.mockClear();
  });

  it('does not rerender static code blocks when story snippets update', () => {
    const docsContext = createMockDocsContext();

    const { rerender } = render(
      <DocsContext.Provider value={docsContext}>
        <SourceContext.Provider value={{ sources: {} }}>
          <StaticSource />
        </SourceContext.Provider>
      </DocsContext.Provider>
    );

    expect(pureSourceSpy).toHaveBeenCalledTimes(1);
    expect(pureSourceSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: '<some>html</some>' })
    );

    rerender(
      <DocsContext.Provider value={docsContext}>
        <SourceContext.Provider
          value={{
            sources: {
              'story--id': {
                [argsHash({})]: {
                  code: 'const emitted = "source";',
                },
              },
            },
          }}
        >
          <StaticSource />
        </SourceContext.Provider>
      </DocsContext.Provider>
    );

    expect(pureSourceSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps rerendering attached source blocks when snippets update', () => {
    const story = {
      id: 'story--id',
      parameters: {
        __isArgsStory: true,
        docs: {
          source: {},
        },
      },
    } as Partial<PreparedStory>;
    const docsContext = createMockDocsContext(story);

    const { rerender } = render(
      <DocsContext.Provider value={docsContext}>
        <SourceContext.Provider value={{ sources: {} }}>
          <StorySource />
        </SourceContext.Provider>
      </DocsContext.Provider>
    );

    expect(pureSourceSpy).toHaveBeenCalledTimes(1);
    expect(pureSourceSpy).toHaveBeenLastCalledWith(expect.objectContaining({ code: '' }));

    rerender(
      <DocsContext.Provider value={docsContext}>
        <SourceContext.Provider
          value={{
            sources: {
              [story.id!]: {
                [argsHash({})]: {
                  code: 'const emitted = "source";',
                },
              },
            },
          }}
        >
          <StorySource />
        </SourceContext.Provider>
      </DocsContext.Provider>
    );

    expect(pureSourceSpy).toHaveBeenCalledTimes(2);
    expect(pureSourceSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'const emitted = "source";' })
    );
  });
});
