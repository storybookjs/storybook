import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Box } from './components/Box';
import { expectStyle } from './expectStyle';

const meta = {
  title: 'StyleX/Layers',
  component: Box,
  args: { children: 'StyleX wins over the reset layer' },
  decorators: [
    (Story) => (
      <div className="stylex-reset">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The preview CSS declares `@layer reset { .stylex-reset div { color: blue; padding: 0 } }`. StyleX is configured
 * with `useCSSLayers: { before: ['reset'] }`, so its priority layers come after the reset.
 */
export const WithReset: Story = {
  play: async ({ canvas }) => {
    await expectStyle(canvas.getByTestId('box'), { color: 'rgb(29, 78, 216)', padding: '16px' });
  },
};

/** An unlayered reset beats every layered StyleX rule. Shown for the docs, not tested. */
export const UnlayeredResetPitfall: Story = {
  tags: ['!test'],
  parameters: { chromatic: { disableSnapshot: true } },
  args: { children: 'Unlayered reset: StyleX colour and padding are lost' },
  decorators: [
    (Story) => (
      <div className="unlayered-reset">
        <style>{'.unlayered-reset div { color: blue; padding: 0; }'}</style>
        <Story />
      </div>
    ),
  ],
};
