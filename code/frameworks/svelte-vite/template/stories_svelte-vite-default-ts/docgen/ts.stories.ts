import type { Meta } from '@storybook/svelte-vite';

import TS from './ts.svelte';

const meta = {
  component: TS,
  tags: ['autodocs'],
  // These stories exist for the docgen sandbox baselines; the canvas shows no docgen output.
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof TS>;

export default meta;

export const Default = {};
