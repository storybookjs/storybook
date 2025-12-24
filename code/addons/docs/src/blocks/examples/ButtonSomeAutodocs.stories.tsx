import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  title: 'examples/ButtonSomeAutodocs',
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
  tags: ['autodocs'],
  args: {
    label: 'Button',
  },
};

export const ForcedBgLight: Story = {
  tags: ['autodocs'],
  args: {
    label: 'Button',
  },
  globals: {
    backgrounds: {
      value: 'light',
    },
  },
};

export const ForcedBgDark: Story = {
  tags: ['autodocs'],
  args: {
    label: 'Button',
  },
  globals: {
    backgrounds: {
      value: 'dark',
    },
  },
};

export const ForcedBgBlue: Story = {
  tags: ['autodocs'],
  args: {
    label: 'Button',
  },
  globals: {
    backgrounds: {
      value: 'blue',
    },
  },
};

export const LastStory: Story = {
  tags: ['autodocs'],
  args: {
    label: 'Button',
  },
};
