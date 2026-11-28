import type { Meta } from '@storybook/svelte';

import AtInBackticks from './at-in-backticks.svelte';

// No meta docblock here, so the stories file can't change the component description.
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
