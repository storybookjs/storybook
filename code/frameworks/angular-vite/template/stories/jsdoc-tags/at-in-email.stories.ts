import type { Meta, StoryObj } from '@storybook/angular-vite';

import { AtInEmailComponent } from './at-in-email.component';

// No meta docblock here, so the stories file can't change the component description.
const meta: Meta<AtInEmailComponent> = {
  component: AtInEmailComponent,
  tags: ['autodocs'],
  args: { label: 'AtInEmailComponent' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Default: StoryObj<AtInEmailComponent> = {};
