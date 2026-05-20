import type {
  DocsIndexEntry,
  StoryIndex,
  StoryIndexEntry,
  StatusesByStoryIdAndTypeId,
  StatusValue,
} from 'storybook/internal/types';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import type { API } from '../../../manager-api/index.ts';

import { IconSymbolsDecorator, MockAPIDecorator } from './Filter.story-helpers.tsx';
import { FilterPanel } from './FilterPanel.tsx';

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

// Helper to build an allStatuses map with one entry per status value
const makeStatuses = (
  ...values: Array<{ storyId: string; typeId: string; statusValue: StatusValue; title: string }>
): StatusesByStoryIdAndTypeId =>
  values.reduce<StatusesByStoryIdAndTypeId>((acc, { storyId, typeId, statusValue, title }) => {
    acc[storyId] ??= {};
    acc[storyId][typeId] = {
      value: statusValue,
      typeId,
      storyId,
      title,
      description: '',
    };
    return acc;
  }, {});

const meta = {
  component: FilterPanel,
  title: 'Sidebar/FilterPanel',
  // Will provide api mock
  decorators: [MockAPIDecorator, IconSymbolsDecorator],
  tags: ['hoho'],
  args: {
    api: {} as API,
    indexJson: {
      v: 6,
      entries: getEntries(true),
    } as StoryIndex,
    defaultExcludedFilters: [],
    defaultIncludedFilters: [],
    includedFilters: [],
    excludedFilters: [],
    allStatuses: {},
    includedStatusFilters: [],
    excludedStatusFilters: [],
  },
} satisfies Meta<typeof FilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const BuiltInOnly: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(false),
    } as StoryIndex,
    allStatuses: makeStatuses(
      {
        storyId: 'c1-story1',
        typeId: 'change-detection',
        statusValue: 'status-value:new',
        title: 'New',
      },
      {
        storyId: 'c1-story2',
        typeId: 'change-detection',
        statusValue: 'status-value:modified',
        title: 'Modified',
      },
      {
        storyId: 'c2-story1',
        typeId: 'change-detection',
        statusValue: 'status-value:affected',
        title: 'Affected',
      }
    ),
  },
};

/**
 * Production is equal to development now. We want to avoid a completely empty FilterPanel and
 * we can't easily detect if there'll be items matching the built-in filters. Plus, onboarding users
 * on custom tags is still useful in production.
 */
export const BuiltInOnlyProduction: Story = {
  args: {
    ...BuiltInOnly.args,
  },
};

export const Included: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(true),
    } as StoryIndex,
    includedFilters: ['tag1'],
  },
};

export const Excluded: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(true),
    } as StoryIndex,
    excludedFilters: ['tag1'],
  },
};

export const Mixed: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(true),
    } as StoryIndex,
    includedFilters: ['tag1'],
    excludedFilters: ['tag2'],
  },
};

export const DefaultSelection: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(true),
    } as StoryIndex,
    includedFilters: ['tag1'],
    excludedFilters: ['tag2'],
    defaultIncludedFilters: ['tag1'],
    defaultExcludedFilters: ['tag2'],
  },
};

export const DefaultSelectionModified: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: getEntries(true),
    } as StoryIndex,
    includedFilters: ['tag1', 'tag2'],
    defaultIncludedFilters: ['tag1'],
    defaultExcludedFilters: ['tag2'],
  },
};

export const WithStatuses: Story = {
  args: {
    allStatuses: makeStatuses(
      {
        storyId: 'c1-story1',
        typeId: 'change-detection',
        statusValue: 'status-value:new',
        title: 'New',
      },
      {
        storyId: 'c1-story2',
        typeId: 'change-detection',
        statusValue: 'status-value:modified',
        title: 'Modified',
      },
      {
        storyId: 'c2-story1',
        typeId: 'change-detection',
        statusValue: 'status-value:affected',
        title: 'Affected',
      }
    ),
  },
};

export const WithStatusesIncluded: Story = {
  args: {
    ...WithStatuses.args,
    includedStatusFilters: ['status-value:new', 'status-value:modified'],
  },
};

export const WithStatusesExcluded: Story = {
  args: {
    ...WithStatuses.args,
    excludedStatusFilters: ['status-value:affected'],
  },
};

export const OnlyNewStatus: Story = {
  args: {
    allStatuses: makeStatuses({
      storyId: 'c1-story1',
      typeId: 'change-detection',
      statusValue: 'status-value:new',
      title: 'New',
    }),
  },
};

export const OnlyModifiedStatus: Story = {
  args: {
    allStatuses: makeStatuses({
      storyId: 'c1-story2',
      typeId: 'change-detection',
      statusValue: 'status-value:modified',
      title: 'Modified',
    }),
  },
};

export const OnlyAffectedStatus: Story = {
  args: {
    allStatuses: makeStatuses({
      storyId: 'c2-story1',
      typeId: 'change-detection',
      statusValue: 'status-value:affected',
      title: 'Affected',
    }),
  },
};

const projectedCounterEntries = {
  'foo-1': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
  'foo-2': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
  'foo-3': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
  'foo-4': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
  'foo-5': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
  'bar-1': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
  'bar-2': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
  'bar-3': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
  'bar-4': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
  'bar-5': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
  'ter-1': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-2': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-3': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-4': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-5': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-6': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-7': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-8': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-9': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
  'ter-10': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
};

export const ProjectedTagCounts: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: projectedCounterEntries,
    } as StoryIndex,
    includedFilters: ['foo', 'bar'],
  },
  play: async ({ canvas }) => {
    const terCheckbox = await canvas.findByRole('checkbox', {
      name: /include tag filter ter\. 10 items would be added\./i,
    });

    await userEvent.hover(terCheckbox);

    await expect(
      canvas.getByLabelText('20 of 20 items visible if include tag filter ter')
    ).toBeVisible();
    await expect(canvas.getByLabelText('10 items would be added')).toBeVisible();
  },
};
