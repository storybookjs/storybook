import type { Meta } from '@storybook/svelte';

import TagThenText from './tag-then-text.svelte';

// No meta docblock here, so the stories file can't change the component description.
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
