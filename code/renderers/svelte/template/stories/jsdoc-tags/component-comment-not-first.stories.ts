import type { Meta } from '@storybook/svelte';

import ComponentCommentNotFirst from './component-comment-not-first.svelte';

// No meta docblock here, so the stories file can't change the component description.
const meta = {
  component: ComponentCommentNotFirst,
  tags: ['autodocs'],
  args: { label: 'ComponentCommentNotFirst' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof ComponentCommentNotFirst>;

export default meta;

export const Default = {};
