import type { Meta } from '@storybook/svelte-vite';

import TSInlinePropTypes from './ts-inline-prop-types.svelte';

const meta = {
  component: TSInlinePropTypes,
  tags: ['autodocs'],
  // These stories exist for the docgen sandbox baselines; the canvas shows no docgen output.
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof TSInlinePropTypes>;

export default meta;

export const Default = {};
