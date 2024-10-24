import type { Meta, StoryObj } from '@storybook/react';
import { findByRole, fn } from '@storybook/test';

import { TagsFilter } from './TagsFilter';

const meta = {
  component: TagsFilter,
  tags: ['haha'],
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
    initialSelectedTags: ['A', 'B'],
  },
};

export const Open: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    const button = await findByRole(canvasElement, 'button');
    await button.click();
  },
};

export const OpenWithSelection: Story = {
  ...ClosedWithSelection,
  play: Open.play,
};

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
