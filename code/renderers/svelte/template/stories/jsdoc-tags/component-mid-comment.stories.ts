import type { Meta } from '@storybook/svelte';

import ComponentMidComment from './component-mid-comment.svelte';

// No meta docblock here, so the stories file can't change the component description.
const meta = {
  component: ComponentMidComment,
  tags: ['autodocs'],
  args: { label: 'ComponentMidComment' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof ComponentMidComment>;

export default meta;

export const Default = {};
