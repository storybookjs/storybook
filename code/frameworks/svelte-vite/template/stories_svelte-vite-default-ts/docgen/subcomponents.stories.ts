import type { Meta } from '@storybook/svelte-vite';

import { Parts } from './subcomponents/barrel';

const meta = {
  component: Parts.Ts,
  subcomponents: { Jsdoc: Parts.Jsdoc },
  tags: ['autodocs'],
  // These stories exist for the docgen sandbox baselines; the canvas shows no docgen output.
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof Parts.Ts>;

export default meta;

export const Default = {};
