import type { Meta, StoryObj } from '@storybook/svelte';
import { expect } from 'storybook/test';

import Swatch from './components/Swatch.svelte';

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
    await expect(getComputedStyle(canvas.getByTestId('swatch')).color).toBe('rgb(190, 18, 60)');
  },
};

/** `defineVars` from the installed `stylex-tokens-fixture` package, without public CSS variables */
export const PackageTokens: Story = {
  args: { source: 'package' },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByTestId('swatch')).color).toBe('rgb(124, 58, 237)');
  },
};
