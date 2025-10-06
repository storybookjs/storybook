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
    includedFilters: new Set(),
    excludedFilters: new Set(),
    resetFilters: fn(),
    isDefaultSelection: true,
    hasDefaultSelection: false,
    api: {
      getDocsUrl: () => 'https://storybook.js.org/docs/',
    } as any,
    isDevelopment: true,
  },
  tags: ['hoho'],
} satisfies Meta<typeof TagsFilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const BuiltInOnly: Story = {
  args: {
    filtersById: builtInFilters,
  },
};

export const BuiltInOnlyProduction: Story = {
  args: {
    ...BuiltInOnly.args,
    isDevelopment: false,
  },
};

export const Included: Story = {
  args: {
    includedFilters: new Set(['tag1', '_play']),
    isDefaultSelection: false,
  },
};

export const Excluded: Story = {
  args: {
    excludedFilters: new Set(['tag1', '_play']),
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
