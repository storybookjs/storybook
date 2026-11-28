import type { Meta } from '@storybook/svelte';

import AtInProse from './at-in-prose.svelte';

// No meta docblock here, so the stories file can't change the component description.
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
