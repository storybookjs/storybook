import type { Meta, StoryObj } from '@storybook/angular-vite';

import { AtInProseComponent } from './at-in-prose.component';

// No meta docblock here, so the stories file can't change the component description.
const meta: Meta<AtInProseComponent> = {
  component: AtInProseComponent,
  tags: ['autodocs'],
  args: { label: 'AtInProseComponent' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Default: StoryObj<AtInProseComponent> = {};
