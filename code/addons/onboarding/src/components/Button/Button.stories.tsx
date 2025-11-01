import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Primary Button' },
};

export const Secondary: Story = {
  args: { children: 'Secondary Button', variant: 'secondary' },
};

export const Outline: Story = {
  args: { children: 'Outline Button', variant: 'outline' },
};

export const White: Story = {
  args: { children: 'White Button', variant: 'white' },
};
