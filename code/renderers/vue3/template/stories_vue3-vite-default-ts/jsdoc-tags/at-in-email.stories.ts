import type { Meta } from '@storybook/vue3';

import AtInEmail from './at-in-email.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
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
