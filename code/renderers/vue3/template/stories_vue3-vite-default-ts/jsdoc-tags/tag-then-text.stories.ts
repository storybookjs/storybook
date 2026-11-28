import type { Meta } from '@storybook/vue3';

import TagThenText from './tag-then-text.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
const meta = {
  component: TagThenText,
  tags: ['autodocs'],
  args: { label: 'TagThenText' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TagThenText>;

export default meta;

export const Default = {};
