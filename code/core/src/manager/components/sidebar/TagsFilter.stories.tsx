import type { DocsIndexEntry, StoryIndexEntry } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { API } from 'storybook/manager-api';
import { expect, screen, waitFor } from 'storybook/test';

import { TagsFilter } from './TagsFilter';
import { MockAPIDecorator } from './TagsFilter.story-helpers';

const meta = {
  component: TagsFilter,
  title: 'Sidebar/TagsFilter',
  tags: ['haha', 'this-is-a-very-long-tag-that-will-be-truncated-after-a-while'],
  decorators: [MockAPIDecorator],
  args: {
    api: {} as API, // Will be overridden by MockAPIWrapper
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['A', 'B', 'C', 'dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
        'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
        'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
      },
    },
  },
} satisfies Meta<typeof TagsFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const ClosedWithDefaultTags: Story = {
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
  ...Clear,
  args: {
    ...Clear.args,
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['dev', 'play-fn'], type: 'story' } as StoryIndexEntry,
        'c1-test': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
        'c1-doc': { tags: [], type: 'docs' } as unknown as DocsIndexEntry,
      },
    },
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
      excludedTagFilters: ['A', 'B'],
    },
  },
} satisfies Story;

export const WithSelectionMixed = {
  ...Clear,
  parameters: {
    initialStoryState: {
      includedTagFilters: ['A'],
      excludedTagFilters: ['B'],
    },
  },
} satisfies Story;

export const Empty: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: {},
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
  args: {
    ...Empty.args,
  },
  play: Empty.play,
};
