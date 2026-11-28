import type { Meta } from '@storybook/vue3';

import AtInBackticks from './at-in-backticks.vue';

// No meta docblock here: on the docgen server it would replace the component docblock.
const meta = {
  component: AtInBackticks,
  tags: ['autodocs'],
  args: { label: 'AtInBackticks' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof AtInBackticks>;

export default meta;

export const Default = {};
