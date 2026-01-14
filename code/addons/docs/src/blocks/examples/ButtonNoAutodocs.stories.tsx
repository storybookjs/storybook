import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  title: 'examples/ButtonNoAutodocs',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  parameters: {
    chromatic: { disableSnapshot: true },
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
  args: {
    label: 'Button',
  },
};
