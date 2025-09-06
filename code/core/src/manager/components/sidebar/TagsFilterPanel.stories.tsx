import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { TagsFilterPanel } from './TagsFilterPanel';

const meta = {
  component: TagsFilterPanel,
  title: 'Sidebar/TagsFilterPanel',
  args: {
    toggleTag: fn(),
    setAllTags: fn(),
    inverted: false,
    setInverted: fn(),
    api: {
      getDocsUrl: () => 'https://storybook.js.org/docs/',
    } as any,
    isDevelopment: true,
  },
  tags: ['hoho'],
} satisfies Meta<typeof TagsFilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    allTags: new Map(),
    selectedTags: [],
  },
};

export const BuiltInTagsOnly: Story = {
  args: {
    allTags: new Map([['play-fn', 1]]),
    selectedTags: [],
  },
};

export const BuiltInTagsOnlyProduction: Story = {
  args: {
    ...BuiltInTagsOnly.args,
    isDevelopment: false,
  },
};

export const Default: Story = {
  args: {
    allTags: new Map([
      ['tag1', 1],
      ['tag2', 1],
      ['tag3', 1],
    ]),
    selectedTags: ['tag1', 'tag3'],
  },
};

export const Inverted: Story = {
  args: {
    ...Default.args,
    inverted: true,
  },
};

export const BuiltInTags: Story = {
  args: {
    allTags: new Map([...Default.args.allTags, ['play-fn', 1]]),
    selectedTags: ['tag1', 'tag3'],
  },
};

export const ExtraBuiltInTagsSelected: Story = {
  args: {
    ...BuiltInTags.args,
    selectedTags: ['tag1', 'tag3', 'autodocs', 'play-fn'],
  },
};
