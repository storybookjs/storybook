import type { Meta } from '@storybook/vue3';

import AtInProse from './at-in-prose.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
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
