import type { Meta } from '@storybook/svelte';

import AtInEmail from './at-in-email.svelte';

// No meta docblock here, so the stories file can't change the component description.
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
