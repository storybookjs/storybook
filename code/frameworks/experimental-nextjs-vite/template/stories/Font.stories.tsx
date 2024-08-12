import type { Meta, StoryObj } from '@storybook/react';

import Font from './Font';

const meta = {
  component: Font,
} satisfies Meta<typeof Font>;

export default meta;

type Story = StoryObj<typeof meta>;

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
