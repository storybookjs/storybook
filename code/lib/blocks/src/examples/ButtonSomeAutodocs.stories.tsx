import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  title: 'examples/ButtonSomeAutodocs',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  parameters: {
    chromatic: { disable: true },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};

export const Secondary: Story = {
  tags: ['autodocs'],
  args: {
    label: 'Button',
  },
};
