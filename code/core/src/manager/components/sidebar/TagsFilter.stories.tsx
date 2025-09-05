import type { Meta, StoryObj } from '@storybook/react-vite';

import { findByRole, fn } from 'storybook/test';

import { TagsFilter } from './TagsFilter';

const meta = {
  component: TagsFilter,
  title: 'Sidebar/TagsFilter',
  tags: ['haha', 'this-is-a-very-long-tag-that-will-be-truncated-after-a-while'],
  args: {
    api: {
      experimental_setFilter: fn(),
      getDocsUrl: () => 'https://storybook.js.org/docs/',
      getUrlState: () => ({
        queryParams: {},
        path: '',
        viewMode: 'story',
        url: 'http://localhost:6006/',
      }),
      applyQueryParams: fn().mockName('api::applyQueryParams'),
    } as any,
    isDevelopment: true,
    tagPresets: {},
  },
} satisfies Meta<typeof TagsFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['A', 'B', 'C', 'dev'] } as any,
      },
    },
  },
};

export const ClosedWithSelection: Story = {
  args: {
    ...Closed.args,
    tagPresets: {
      A: { defaultFilterSelection: 'include' },
      B: { defaultFilterSelection: 'include' },
    },
  },
};

export const Open = {
  ...Closed,
  play: async ({ canvasElement }) => {
    const button = await findByRole(canvasElement, 'button');
    await button.click();
  },
} satisfies Story;

export const OpenWithSelection = {
  ...ClosedWithSelection,
  play: Open.play,
} satisfies Story;

export const OpenWithSelectionInverted = {
  ...Open,
  args: {
    ...Open.args,
    tagPresets: {
      A: { defaultFilterSelection: 'exclude' },
      B: { defaultFilterSelection: 'exclude' },
    },
  },
} satisfies Story;

export const OpenWithSelectionMixed = {
  ...Open,
  args: {
    ...Open.args,
    tagPresets: {
      A: { defaultFilterSelection: 'include' },
      B: { defaultFilterSelection: 'exclude' },
    },
  },
} satisfies Story;

export const OpenEmpty: Story = {
  args: {
    indexJson: {
      v: 6,
      entries: {},
    },
  },
  play: Open.play,
};

export const EmptyProduction: Story = {
  args: {
    ...OpenEmpty.args,
    isDevelopment: false,
  },
};
