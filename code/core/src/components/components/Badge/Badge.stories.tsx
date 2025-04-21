import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './Badge';

const meta = {
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = { args: { children: 'Default' } } satisfies Story;
export const Active = { args: { status: 'active', children: 'Active' } } satisfies Story;
export const Positive = { args: { status: 'positive', children: 'Positive' } } satisfies Story;
export const Negative = { args: { status: 'negative', children: 'Negative' } } satisfies Story;
export const Neutral = { args: { status: 'neutral', children: 'Neutral' } } satisfies Story;
export const Warning = { args: { status: 'warning', children: 'Warning' } } satisfies Story;
export const Critical = { args: { status: 'critical', children: 'Critical' } } satisfies Story;

export const Compact = {
  args: { compact: true, status: 'neutral', children: '12' },
} satisfies Story;
