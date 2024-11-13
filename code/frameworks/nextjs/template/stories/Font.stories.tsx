import type { Meta, StoryObj } from '@storybook/react';

import Font from './Font';

export default {
  component: Font,
} as Meta<typeof Font>;

type Story = StoryObj<typeof Font>;

export const WithClassName: Story = {
  args: {
    variant: 'className',
  },
};

export const WithStyle: Story = {
  args: {
    variant: 'style',
  },
};

export const WithVariable: Story = {
  args: {
    variant: 'variable',
  },
};
