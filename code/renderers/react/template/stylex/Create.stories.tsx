import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { Box } from './components/Box';

const meta = {
  title: 'StyleX/Create',
  component: Box,
  args: { children: 'Styled with stylex.create' },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async ({ canvas }) => {
    const box = getComputedStyle(canvas.getByTestId('box'));
    await expect(box.padding).toBe('16px');
    await expect(box.color).toBe('rgb(29, 78, 216)');
    await expect(box.borderRadius).toBe('8px');
  },
};

export const Dynamic: Story = {
  args: { width: 240, children: 'Width from an arg' },
  play: async ({ canvas, args }) => {
    await expect(getComputedStyle(canvas.getByTestId('box')).width).toBe(`${args.width}px`);
  },
};
