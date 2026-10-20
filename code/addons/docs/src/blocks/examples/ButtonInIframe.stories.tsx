import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  title: 'examples/ButtonInIframe',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: { story: { inline: false, height: '80px' } },
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
