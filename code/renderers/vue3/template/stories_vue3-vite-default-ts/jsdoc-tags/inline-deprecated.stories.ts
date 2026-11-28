import type { Meta } from '@storybook/vue3';

import InlineDeprecated from './inline-deprecated.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
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
