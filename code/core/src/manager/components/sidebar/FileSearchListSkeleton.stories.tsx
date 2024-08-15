import type { Meta, StoryObj } from '@storybook/react';

import { FileSearchListLoadingSkeleton } from './FileSearchListSkeleton';

const meta = {
  component: FileSearchListLoadingSkeleton,
} satisfies Meta<typeof FileSearchListLoadingSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
