import type { Meta } from '@storybook/svelte';

import TaggedButton from './tagged-button.svelte';

// No meta docblock here, so the stories file can't change the component description.
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
