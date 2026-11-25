import type { Meta } from '@storybook/react';

import { AtInBackticks } from './at-in-backticks';

const meta = {
  component: AtInBackticks,
  tags: ['autodocs'],
  args: { label: 'AtInBackticks' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof AtInBackticks>;

export default meta;

export const Default = {};
