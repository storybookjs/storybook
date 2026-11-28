import type { Meta } from '@storybook/svelte';

import NestedComponentComment from './nested-component-comment.svelte';

// No meta docblock here, so the stories file can't change the component description.
const meta = {
  component: NestedComponentComment,
  tags: ['autodocs'],
  args: { label: 'NestedComponentComment' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof NestedComponentComment>;

export default meta;

export const Default = {};
