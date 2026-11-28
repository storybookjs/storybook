import type { Meta } from '@storybook/vue3';

import TaggedButton from './tagged-button.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
const meta = {
  component: TaggedButton,
  tags: ['autodocs'],
  args: { label: 'TaggedButton' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TaggedButton>;

export default meta;

export const Default = {};
