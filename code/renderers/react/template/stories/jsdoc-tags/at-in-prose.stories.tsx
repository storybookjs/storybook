import type { Meta } from '@storybook/react';

import { AtInProse } from './at-in-prose';

const meta = {
  component: AtInProse,
  tags: ['autodocs'],
  args: { label: 'AtInProse' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof AtInProse>;

export default meta;

export const Default = {};
