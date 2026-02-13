import type { DocsIndexEntry, StoryIndexEntry } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { API } from 'storybook/manager-api';

import { MockAPIDecorator } from './TagsFilter.stories';
import { TagsFilterPanel } from './TagsFilterPanel';

const getEntries = (includeUserTags: boolean) => {
  const entries = {
    'c1-autodocs': { tags: ['tag1', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c1-story1': { tags: ['tag1', 'dev'], type: 'story' } as StoryIndexEntry,
    'c1-story2': { tags: ['tag1'], type: 'story' } as StoryIndexEntry,
    'c2-autodocs': { tags: ['tag1', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c2-story1': { tags: ['tag1', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c2-story2': { tags: ['tag1'], type: 'story' } as StoryIndexEntry,
    'c2-story3': { tags: ['tag1'], type: 'story' } as StoryIndexEntry,
    'c3-autodocs': { tags: ['tag1', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c3-story1': { tags: ['tag1', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c3-story2': { tags: ['tag1', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c3-story3': { tags: ['tag1', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c4-autodocs': { tags: ['tag1', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c4-story1': { tags: ['tag1'], type: 'story' } as StoryIndexEntry,
    'c4-story2': { tags: ['tag1'], type: 'story' } as StoryIndexEntry,
    'c5-autodocs': { tags: ['tag2', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c5-story1': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c5-story2': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c5-story3': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c6-autodocs': { tags: ['tag2', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c6-story1': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c6-story2': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c6-story3': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c7-autodocs': { tags: ['tag2', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c7-story1': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c7-story2': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c7-story3': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c8-autodocs': { tags: ['tag2', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c8-story1': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c8-story2': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c8-story3': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c9-autodocs': { tags: ['tag2', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c9-story1': { tags: ['tag2'], type: 'story' } as StoryIndexEntry,
    'c9-story2': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c9-story3': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c10-autodocs': { tags: ['tag2', 'autodocs'], type: 'docs' } as DocsIndexEntry,
    'c10-story1': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c10-story2': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c10-story3': { tags: ['tag2', 'play-fn'], type: 'story' } as StoryIndexEntry,
    'c11-story1': {
      tags: ['tag3-which-is-very-long-and-will-be-truncated-after-a-while'],
      type: 'story',
    } as StoryIndexEntry,
    'c11-story2': {
      tags: ['tag3-which-is-very-long-and-will-be-truncated-after-a-while'],
      type: 'story',
    } as StoryIndexEntry,
    'c12-s1-test1': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test2': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test3': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test4': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test5': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test6': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test7': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s1-test8': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test1': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test2': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test3': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test4': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test5': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test6': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test7': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
    'c12-s3-test8': { tags: ['test-fn'], type: 'story', subtype: 'test' } as StoryIndexEntry,
  };

  if (!includeUserTags) {
    Object.values(entries).forEach((entry) => {
      entry.tags = entry.tags?.filter((tag) =>
        ['autodocs', 'dev', 'play-fn', 'test-fn'].includes(tag)
      );
    });
  }

  return entries;
};

const meta = {
  component: TagsFilterPanel,
  title: 'Sidebar/TagsFilterPanel',
  decorators: [MockAPIDecorator],
  args: {
    api: {} as API, // Will be overridden by MockAPIWrapper
    indexJson: {
      v: 6,
      entries: getEntries(true),
    },
  },
  tags: ['hoho'],
} satisfies Meta<typeof TagsFilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const BuiltInOnly: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(false),
    },
  },
};

/**
 * Production is equal to development now. We want to avoid a completely empty TagsFilterPanel and
 * we can't easily detect if there'll be items matching the built-in filters. Plus, onboarding users
 * on custom tags is still useful in production.
 */
export const BuiltInOnlyProduction: Story = {
  args: {
    ...BuiltInOnly.args,
  },
};

export const Included: Story = {
  parameters: {
    initialStoryState: {
      layout: {
        includedTagFilters: ['tag1'],
      },
    },
  },
};

export const Excluded: Story = {
  parameters: {
    initialStoryState: {
      layout: {
        excludedTagFilters: ['tag1'],
      },
    },
  },
};

export const Mixed: Story = {
  parameters: {
    initialStoryState: {
      layout: {
        includedTagFilters: ['tag1'],
        excludedTagFilters: ['tag2'],
      },
    },
  },
};

export const DefaultSelection: Story = {
  beforeEach: () => {
    const originalTagsOptions = global.TAGS_OPTIONS;
    global.TAGS_OPTIONS = {
      tag1: { defaultFilterSelection: 'include' },
      tag2: { defaultFilterSelection: 'exclude' },
    };

    return () => {
      global.TAGS_OPTIONS = originalTagsOptions;
    };
  },
};

export const DefaultSelectionModified: Story = {
  beforeEach: () => {
    const originalTagsOptions = global.TAGS_OPTIONS;
    global.TAGS_OPTIONS = {
      tag1: { defaultFilterSelection: 'include' },
      tag2: { defaultFilterSelection: 'exclude' },
    };

    return () => {
      global.TAGS_OPTIONS = originalTagsOptions;
    };
  },
  parameters: {
    initialStoryState: {
      layout: {
        includedTagFilters: ['tag1', 'tag2'],
      },
    },
  },
};
