import type { Meta, StoryObj } from '@storybook/react';
import Badge from '../src/components/Badge';

const meta = {
  title: 'Example/Badge',
  component: Badge,
  args: {
    children: 'New',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = {};

export const Neutral: Story = {
  args: {
    variant: 'neutral',
    children: 'Archived',
  },
};
