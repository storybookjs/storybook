import type { Meta, StoryObj } from '@storybook/angular-vite';

import { AtInBackticksComponent } from './at-in-backticks.component';

// No meta docblock here, so the stories file can't change the component description.
const meta: Meta<AtInBackticksComponent> = {
  component: AtInBackticksComponent,
  tags: ['autodocs'],
  args: { label: 'AtInBackticksComponent' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Default: StoryObj<AtInBackticksComponent> = {};
