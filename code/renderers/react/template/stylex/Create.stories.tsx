import type { Meta, StoryObj } from '@storybook/react';

import { Box } from './components/Box';
import { expectStyle } from './expectStyle';

const meta = {
  title: 'StyleX/Create',
  component: Box,
  args: { children: 'Styled with stylex.create' },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async ({ canvas }) => {
    await expectStyle(canvas.getByTestId('box'), {
      padding: '16px',
      color: 'rgb(29, 78, 216)',
      borderRadius: '8px',
    });
  },
};

export const Dynamic: Story = {
  args: { width: 240, children: 'Width from an arg' },
  play: async ({ canvas, args }) => {
    await expectStyle(canvas.getByTestId('box'), { width: `${args.width}px` });
  },
};
