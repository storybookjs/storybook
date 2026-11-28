import type { Meta } from '@storybook/svelte';

import InlineDeprecated from './inline-deprecated.svelte';

// No meta docblock here, so the stories file can't change the component description.
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
