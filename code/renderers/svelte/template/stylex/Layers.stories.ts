import type { Meta, StoryObj } from '@storybook/svelte';

import BoxWithText from './BoxWithText.svelte';
import UnlayeredReset from './UnlayeredReset.svelte';
import { expectStyle } from './expectStyle';

const meta = {
  title: 'StyleX/Layers',
  component: BoxWithText,
  args: { text: 'StyleX wins over the reset layer' },
} satisfies Meta<typeof BoxWithText>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The preview CSS declares `@layer reset { div { color: blue; padding: 0 } }`. StyleX is configured
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
  args: { text: 'Unlayered reset: StyleX colour and padding are lost' },
  decorators: [() => ({ Component: UnlayeredReset })],
};
