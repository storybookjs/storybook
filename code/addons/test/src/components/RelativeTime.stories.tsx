import type { Meta, StoryObj } from '@storybook/react';

import { RelativeTime } from './RelativeTime';

const meta = {
  component: RelativeTime,
} satisfies Meta<typeof RelativeTime>;

export default meta;

type Story = StoryObj<typeof meta>;

export const JustNow: Story = {
  args: {
    timestamp: Date.now() - 1000 * 10,
  },
};

export const AMinuteAgo: Story = {
  args: {
    timestamp: Date.now() - 1000 * 60,
  },
};

export const MinutesAgo: Story = {
  args: {
    timestamp: Date.now() - 1000 * 60 * 2,
  },
};

export const HoursAgo: Story = {
  args: {
    timestamp: Date.now() - 1000 * 60 * 60 * 3,
  },
};

export const Yesterday: Story = {
  args: {
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
  },
};

export const DaysAgo: Story = {
  args: {
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
};
