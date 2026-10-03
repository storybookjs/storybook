import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { Box } from './components/Box';

const meta = {
  title: 'StyleX/Layers',
  component: Box,
  args: { children: 'StyleX wins over the reset layer' },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The preview CSS declares `@layer reset { div { color: blue; padding: 0 } }`. StyleX is configured
 * with `useCSSLayers: { before: ['reset'] }`, so its priority layers come after the reset.
 */
export const WithReset: Story = {
  play: async ({ canvas }) => {
    const box = getComputedStyle(canvas.getByTestId('box'));
    await expect(box.color).toBe('rgb(29, 78, 216)');
    await expect(box.padding).toBe('16px');
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
