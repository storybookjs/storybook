import type { Meta } from '@storybook/react';

import { AtInEmail } from './at-in-email';

const meta = {
  component: AtInEmail,
  tags: ['autodocs'],
  args: { label: 'AtInEmail' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof AtInEmail>;

export default meta;

export const Default = {};
