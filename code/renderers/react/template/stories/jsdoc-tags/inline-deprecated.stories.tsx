import type { Meta } from '@storybook/react';

import { InlineDeprecated } from './inline-deprecated';

const meta = {
  component: InlineDeprecated,
  tags: ['autodocs'],
  args: { label: 'InlineDeprecated' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof InlineDeprecated>;

export default meta;

export const Default = {};
