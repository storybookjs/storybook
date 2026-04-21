import { BeakerIcon, DocumentIcon, PlayHollowIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';
import { color } from 'storybook/theming';

import { TagsFilterPanel } from './TagsFilterPanel';

const builtInFilters = {
  _docs: {
    id: '_docs',
    type: 'built-in',
    title: 'Documentation',
    icon: <DocumentIcon color={color.gold} />,
    count: 8,
    filterFn: fn(),
  },
  _play: {
    id: '_play',
    type: 'built-in',
    title: 'Play',
    icon: <PlayHollowIcon color={color.seafoam} />,
    count: 21,
    filterFn: fn(),
  },
  _test: {
    id: '_test',
    type: 'built-in',
    title: 'Testing',
    icon: <BeakerIcon color={color.green} />,
    count: 42,
    filterFn: fn(),
  },
};

const meta = {
  component: TagsFilterPanel,
  title: 'Sidebar/TagsFilterPanel',
  args: {
    toggleFilter: fn(),
    setAllFilters: fn(),
    filtersById: {
      tag1: {
        id: 'tag1',
        type: 'tag',
        title: 'Tag1',
        count: 11,
        filterFn: fn(),
      },
      tag2: {
        id: 'tag2',
        type: 'tag',
        title: 'Tag2',
        count: 24,
        filterFn: fn(),
      },
      'tag3-which-is-very-long-and-will-be-truncated-after-a-while': {
        id: 'tag3-which-is-very-long-and-will-be-truncated-after-a-while',
        type: 'tag',
        title: 'Tag3',
        count: 2,
        filterFn: fn(),
      },
      ...builtInFilters,
    },
    filteredCounts: {
      tag1: 11,
      tag2: 24,
      'tag3-which-is-very-long-and-will-be-truncated-after-a-while': 2,
      _docs: 8,
      _play: 21,
      _test: 42,
    },
    includedFilters: new Set(),
    excludedFilters: new Set(),
    resetFilters: fn(),
    isDefaultSelection: true,
    hasDefaultSelection: false,
    api: {
      getDocsUrl: () => 'https://storybook.js.org/docs/',
    } as any,
  },
  tags: ['hoho'],
} satisfies Meta<typeof TagsFilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const BuiltInOnly: Story = {
  args: {
    filtersById: builtInFilters,
    filteredCounts: {
      _docs: 8,
      _play: 21,
      _test: 42,
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
  args: {
    includedFilters: new Set(['tag1', '_play']),
    isDefaultSelection: false,
  },
};

export const PartiallyFiltered: Story = {
  args: {
    includedFilters: new Set(['tag1']),
    filteredCounts: {
      tag1: 11,
      tag2: 5,
      'tag3-which-is-very-long-and-will-be-truncated-after-a-while': 1,
      _docs: 3,
      _play: 8,
      _test: 11,
    },
    isDefaultSelection: false,
  },
};

/**
 * Built-in filters with zero visible count are hidden from the panel. Tag filters always show even
 * with zero count.
 */
export const BuiltInFiltersHiddenWhenZero: Story = {
  args: {
    filtersById: {
      tag1: {
        id: 'tag1',
        type: 'tag',
        title: 'Tag1',
        count: 11,
        filterFn: fn(),
      },
      ...builtInFilters,
    },
    includedFilters: new Set(['tag1']),
    filteredCounts: {
      tag1: 11,
      _docs: 0, // Hidden because built-in with zero count
      _play: 0, // Hidden because built-in with zero count
      _test: 5, // Shown because it has matches
    },
    isDefaultSelection: false,
  },
};

export const Excluded: Story = {
  args: {
    excludedFilters: new Set(['tag1', '_play']),
    isDefaultSelection: false,
  },
};

/**
 * When filters are excluded, their counts are shown with strikethrough. The visible count reflects
 * items that DON'T have the excluded tag.
 */
export const ExcludedWithFilteredCounts: Story = {
  args: {
    excludedFilters: new Set(['tag2']),
    filteredCounts: {
      tag1: 11, // All tag1 items shown (none are excluded)
      tag2: 0, // No tag2 items shown (all excluded)
      'tag3-which-is-very-long-and-will-be-truncated-after-a-while': 2,
      _docs: 5, // Only 5 docs don't have tag2
      _play: 17, // Only 17 play items don't have tag2
      _test: 30, // Only 30 test items don't have tag2
    },
    isDefaultSelection: false,
  },
};

export const Mixed: Story = {
  args: {
    includedFilters: new Set(['tag1', '_play']),
    excludedFilters: new Set(['tag2', '_test']),
    isDefaultSelection: false,
  },
};

export const DefaultSelection: Story = {
  args: {
    ...Mixed.args,
    isDefaultSelection: true,
    hasDefaultSelection: true,
  },
};

export const DefaultSelectionModified: Story = {
  args: {
    ...Mixed.args,
    isDefaultSelection: false,
    hasDefaultSelection: true,
  },
};

export const NoMatches: Story = {
  args: {
    includedFilters: new Set(['tag1', 'tag2']),
    excludedFilters: new Set(['tag3-which-is-very-long-and-will-be-truncated-after-a-while']),
    filteredCounts: {
      tag1: 0,
      tag2: 0,
      'tag3-which-is-very-long-and-will-be-truncated-after-a-while': 0,
      _docs: 0,
      _play: 0,
      _test: 0,
    },
    isDefaultSelection: false,
  },
};
