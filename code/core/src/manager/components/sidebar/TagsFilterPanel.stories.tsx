import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { TagsFilterPanel } from './TagsFilterPanel';

const meta = {
  component: TagsFilterPanel,
  args: {
    exclude: false,
    toggleTag: fn(),
    toggleExclude: fn(),
  },
  tags: ['hoho'],
} satisfies Meta<typeof TagsFilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    allTags: [],
    selectedTags: [],
  },
};

export const Default: Story = {
  args: {
    allTags: ['tag1', 'tag2', 'tag3'],
    selectedTags: ['tag1', 'tag3'],
  },
};

export const Exclude: Story = {
  args: {
    ...Default.args,
    exclude: true,
  },
};

export const BuiltInTags: Story = {
  args: {
    allTags: [...Default.args.allTags, 'dev', 'autodocs'],
    selectedTags: ['tag1', 'tag3'],
  },
};

export const BuiltInTagsSelected: Story = {
  args: {
    ...BuiltInTags.args,
    selectedTags: ['tag1', 'tag3', 'autodocs'],
  },
};
