import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { TagsFilterPanel } from './TagsFilterPanel';

const meta = {
  component: TagsFilterPanel,
  title: 'Sidebar/TagsFilterPanel',
  args: {
    toggleTag: fn(),
    setAllTags: fn(),
    allTags: new Map([
      ['play-fn', 1],
      ['test-fn', 1],
      ['tag1', 1],
      ['tag2', 1],
      ['tag3-which-is-very-long-and-will-be-truncated-after-a-while', 1],
    ]),
    includedTags: new Set(),
    excludedTags: new Set(),
    resetTags: fn(),
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

export const Empty: Story = {
  args: {
    allTags: new Map(),
  },
};

export const BuiltInTagsOnly: Story = {
  args: {
    allTags: new Map([
      ['play-fn', 1],
      ['test-fn', 1],
    ]),
  },
};

export const BuiltInTagsOnlyProduction: Story = {
  args: {
    ...BuiltInTagsOnly.args,
    isDevelopment: false,
  },
};

export const Included: Story = {
  args: {
    includedTags: new Set(['tag1', 'play-fn']),
    isDefaultSelection: false,
  },
};

export const Excluded: Story = {
  args: {
    excludedTags: new Set(['tag1', 'play-fn']),
    isDefaultSelection: false,
  },
};

export const Mixed: Story = {
  args: {
    includedTags: new Set(['tag1', 'play-fn']),
    excludedTags: new Set(['tag2', 'test-fn']),
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
