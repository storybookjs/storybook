import type { Meta } from '@storybook/svelte-vite';

import TSReferencedPropTypes from './ts-referenced-prop-types.svelte';

const meta = {
  component: TSReferencedPropTypes,
  tags: ['autodocs'],
  // These stories exist for the docgen sandbox baselines; the canvas shows no docgen output.
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof TSReferencedPropTypes>;

export default meta;

export const Default = {};
