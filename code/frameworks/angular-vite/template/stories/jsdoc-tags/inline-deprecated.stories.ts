import type { Meta, StoryObj } from '@storybook/angular-vite';

import { InlineDeprecatedComponent } from './inline-deprecated.component';

// No meta docblock here, so the stories file can't change the component description.
const meta: Meta<InlineDeprecatedComponent> = {
  component: InlineDeprecatedComponent,
  tags: ['autodocs'],
  args: { label: 'InlineDeprecatedComponent' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Default: StoryObj<InlineDeprecatedComponent> = {};
