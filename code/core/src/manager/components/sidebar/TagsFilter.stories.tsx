import React, { useMemo, useState } from 'react';

import type { DocsIndexEntry, StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, screen, waitFor } from 'storybook/test';

import { TagsFilter } from './TagsFilter';

const getDefaultTagFilters = () => {
  const tagOptions = global.TAGS_OPTIONS ?? {};

  return Object.entries(tagOptions).reduce(
    (acc, [tag, option]) => {
      if (option.defaultFilterSelection === 'include') {
        acc.included.push(tag);
      }
      if (option.defaultFilterSelection === 'exclude') {
        acc.excluded.push(tag);
      }
      return acc;
    },
    { included: [] as string[], excluded: [] as string[] }
  );
};

const createInitialState = (initialStoryState: Record<string, unknown> = {}) => {
  const defaults = getDefaultTagFilters();

  const defaultIncludedTagFilters =
    (initialStoryState.defaultIncludedTagFilters as string[] | undefined) ?? defaults.included;
  const defaultExcludedTagFilters =
    (initialStoryState.defaultExcludedTagFilters as string[] | undefined) ?? defaults.excluded;

  return {
    ...initialStoryState,
    defaultIncludedTagFilters,
    defaultExcludedTagFilters,
    includedTagFilters:
      (initialStoryState.includedTagFilters as string[] | undefined) ?? defaultIncludedTagFilters,
    excludedTagFilters:
      (initialStoryState.excludedTagFilters as string[] | undefined) ?? defaultExcludedTagFilters,
  };
};

const meta = {
  component: TagsFilter,
  title: 'Sidebar/TagsFilter',
  tags: ['haha', 'this-is-a-very-long-tag-that-will-be-truncated-after-a-while'],
  decorators: [
    (Story, { args, parameters }) => {
      const [state, setState] = useState(() =>
        createInitialState(parameters?.initialStoryState as Record<string, unknown> | undefined)
      );

      const api = useMemo(
        () => ({
          addTagFilters: (tags: string[], excluded: boolean) => {
            setState((current: any) => {
              const includedTagFilters = new Set(current.includedTagFilters ?? []);
              const excludedTagFilters = new Set(current.excludedTagFilters ?? []);

              tags.forEach((tag) => {
                if (excluded) {
                  includedTagFilters.delete(tag);
                  excludedTagFilters.add(tag);
                } else {
                  includedTagFilters.add(tag);
                  excludedTagFilters.delete(tag);
                }
              });

              return {
                ...current,
                includedTagFilters: Array.from(includedTagFilters),
                excludedTagFilters: Array.from(excludedTagFilters),
              };
            });
          },
          removeTagFilters: (tags: string[]) => {
            setState((current: any) => ({
              ...current,
              includedTagFilters: (current.includedTagFilters ?? []).filter(
                (tag: string) => !tags.includes(tag)
              ),
              excludedTagFilters: (current.excludedTagFilters ?? []).filter(
                (tag: string) => !tags.includes(tag)
              ),
            }));
          },
          resetTagFilters: () => {
            setState((current: any) => ({
              ...current,
              includedTagFilters: current.defaultIncludedTagFilters ?? [],
              excludedTagFilters: current.defaultExcludedTagFilters ?? [],
            }));
          },
          setAllTagFilters: (included: string[], excluded: string[]) => {
            setState((current: any) => ({
              ...current,
              includedTagFilters: included,
              excludedTagFilters: excluded,
            }));
          },
          getDocsUrl: ({ subpath }: { subpath: string }) =>
            `https://storybook.js.org/docs/${subpath}`,
        }),
        []
      );

      return (
        <ManagerContext.Provider value={{ api, state } as any}>
          <Story args={{ ...args, api }} />
        </ManagerContext.Provider>
      );
    },
  ],
} satisfies Meta<typeof TagsFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {
          'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
          'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
          'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
        },
      } as StoryIndex,
    },
  },
};

export const ClosedWithDefaultTags: Story = {
  ...Closed,
  beforeEach: () => {
    const originalTagsOptions = global.TAGS_OPTIONS;
    global.TAGS_OPTIONS = {
      A: { defaultFilterSelection: 'include' },
      B: { defaultFilterSelection: 'include' },
    };

    return () => {
      global.TAGS_OPTIONS = originalTagsOptions;
    };
  },
};

export const ClosedWithSelection: Story = {
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {
          'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
          'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
          'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
        },
      } as StoryIndex,
      includedTagFilters: ['A', 'B'],
    },
  },
};

export const Clear = {
  ...ClosedWithSelection,
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {}, { timeout: 3000 });
    button.click();

    const clearButton = await screen.findByRole('button', { name: 'Clear filters' });

    expect(clearButton).toBeInTheDocument();
    clearButton.click();
    await waitFor(() => expect(clearButton).not.toBeInTheDocument());
  },
} satisfies Story;

export const ResetToDefaults: Story = {
  ...ClosedWithDefaultTags,
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {
          'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
          'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
          'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
        },
      } as StoryIndex,
      excludedTagFilters: ['A', 'B', 'C'],
    },
  },
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {}, { timeout: 3000 });
    button.click();

    const resetButton = await screen.findByRole('button', { name: 'Reset filters' });

    expect(resetButton).toBeInTheDocument();
    expect(resetButton).not.toBeDisabled();
    resetButton.click();
    await waitFor(() => expect(resetButton).toBeDisabled());
  },
} satisfies Story;

export const NoUserTags = {
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {
          'c1-s1': { tags: ['dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
          'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
          'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
        },
      } as StoryIndex,
    },
  },
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {}, { timeout: 3000 });
    button.click();

    const learnLink = await screen.findByRole('link', { name: 'Learn how to add tags' });

    expect(learnLink).toBeInTheDocument();
  },
} satisfies Story;

export const WithSelection = {
  ...ClosedWithSelection,
  play: Clear.play,
} satisfies Story;

export const WithSelectionInverted = {
  ...Clear,
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {
          'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
          'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
          'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
        },
      } as StoryIndex,
      excludedTagFilters: ['A', 'B'],
    },
  },
} satisfies Story;

export const WithSelectionMixed = {
  ...Clear,
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {
          'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
          'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
          'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
        },
      } as StoryIndex,
      includedTagFilters: ['A'],
      excludedTagFilters: ['B'],
    },
  },
} satisfies Story;

export const Empty: Story = {
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {},
      } as StoryIndex,
    },
  },
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {}, { timeout: 3000 });
    button.click();

    const learnButton = await screen.findByText('Learn how to add tags');
    expect(learnButton).toBeInTheDocument();
  },
};

/** Production is equal to development now */
export const EmptyProduction: Story = {
  parameters: {
    initialStoryState: {
      internal_index: {
        v: 6,
        entries: {},
      } as StoryIndex,
    },
  },
  play: Empty.play,
};
