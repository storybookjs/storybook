import type { Meta } from '@storybook/svelte-vite';

import TSLegacy from './ts-legacy.svelte';

const meta = {
  component: TSLegacy,
  tags: ['autodocs'],
  // These stories exist for the docgen sandbox baselines; the canvas shows no docgen output.
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof TSLegacy>;

export default meta;

export const Default = {};
