import type { Meta } from '@storybook/vue3';

import TaggedButtonSetup from './tagged-button-setup.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
const meta = {
  component: TaggedButtonSetup,
  tags: ['autodocs'],
  args: { label: 'TaggedButtonSetup' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TaggedButtonSetup>;

export default meta;

export const Default = {};
