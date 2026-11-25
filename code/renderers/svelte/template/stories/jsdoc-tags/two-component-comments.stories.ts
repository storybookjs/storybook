import type { Meta } from '@storybook/svelte';

import TwoComponentComments from './two-component-comments.svelte';

// No meta docblock here, so the stories file can't change the component description.
const meta = {
  component: TwoComponentComments,
  tags: ['autodocs'],
  args: { label: 'TwoComponentComments' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TwoComponentComments>;

export default meta;

export const Default = {};
