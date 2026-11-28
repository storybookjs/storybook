import type { Meta, StoryObj } from '@storybook/angular-vite';

import { TaggedButtonComponent } from './tagged-button.component';

// No meta docblock here, so the stories file can't change the component description.
const meta: Meta<TaggedButtonComponent> = {
  component: TaggedButtonComponent,
  tags: ['autodocs'],
  args: { label: 'TaggedButtonComponent' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Default: StoryObj<TaggedButtonComponent> = {};
