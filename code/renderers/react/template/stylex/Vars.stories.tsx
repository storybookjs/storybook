import type { Meta, StoryObj } from '@storybook/react';

import { Swatch } from './components/Swatch';
import { expectStyle } from './expectStyle';

const meta = {
  title: 'StyleX/Vars',
  component: Swatch,
} satisfies Meta<typeof Swatch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `defineVars` from `tokens.stylex.ts` in the project */
export const LocalTokens: Story = {
  args: { source: 'local' },
  play: async ({ canvas }) => {
    await expectStyle(canvas.getByTestId('swatch'), { color: 'rgb(190, 18, 60)' });
  },
};

/** `defineVars` from the installed `stylex-tokens-fixture` package, without public CSS variables */
export const PackageTokens: Story = {
  args: { source: 'package' },
  play: async ({ canvas }) => {
    await expectStyle(canvas.getByTestId('swatch'), { color: 'rgb(124, 58, 237)' });
  },
};
