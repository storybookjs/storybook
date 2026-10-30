import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button.tsx';

/** Two labeled buttons referenced by the manager-docs fixture page. */
const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { label: 'Primary' },
};

export const Secondary: Story = {
  args: { label: 'Secondary' },
};
