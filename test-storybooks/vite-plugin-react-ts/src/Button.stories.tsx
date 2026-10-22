import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button.tsx';

type Story = StoryObj<typeof meta>;

const meta = {
  title: 'Example/Button',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Button',
  },
};
