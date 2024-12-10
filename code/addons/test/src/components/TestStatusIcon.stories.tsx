import type { Meta, StoryObj } from '@storybook/react';

import { TestStatusIcon } from './TestStatusIcon';

const meta = {
  component: TestStatusIcon,
} satisfies Meta<typeof TestStatusIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unknown: Story = {
  args: {
    status: 'unknown',
  },
};

export const Positive: Story = {
  args: {
    status: 'positive',
  },
};

export const Warning: Story = {
  args: {
    status: 'warning',
  },
};

export const Negative: Story = {
  args: {
    status: 'negative',
  },
};

export const Critical: Story = {
  args: {
    status: 'critical',
  },
};

export const UnknownPercentage: Story = {
  args: {
    status: 'unknown',
    percentage: 50,
  },
};

export const PositivePercentage: Story = {
  args: {
    status: 'positive',
    percentage: 60,
  },
};

export const WarningPercentage: Story = {
  args: {
    status: 'warning',
    percentage: 40,
  },
};

export const NegativePercentage: Story = {
  args: {
    status: 'negative',
    percentage: 30,
  },
};
