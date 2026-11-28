import type { Meta } from '@storybook/react';

import { TaggedButton } from './tagged-button';

// No meta docblock here: on the docgen server it would replace the component docblock.
const meta = {
  component: TaggedButton,
  tags: ['autodocs'],
  args: { children: 'Tagged button' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TaggedButton>;

export default meta;

export const Default = {};
