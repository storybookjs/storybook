import type { Meta, StoryObj } from '@storybook/react';
import { findByRole, fn } from '@storybook/test';

import { TagsFilter } from './TagsFilter';

const meta = {
  component: TagsFilter,
  tags: ['haha'],
} satisfies Meta<typeof TagsFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: {
    api: {
      experimental_setFilter: fn(),
    } as any,
    indexJson: {
      v: 6,
      entries: {
        'c1-s1': { tags: ['A', 'B', 'C', 'dev'] } as any,
      },
    },
    updateQueryParams: fn(),
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
