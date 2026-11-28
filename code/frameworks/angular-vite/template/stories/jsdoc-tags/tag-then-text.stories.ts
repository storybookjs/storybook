import type { Meta, StoryObj } from '@storybook/angular-vite';

import { TagThenTextComponent } from './tag-then-text.component';

// No meta docblock here, so the stories file can't change the component description.
const meta: Meta<TagThenTextComponent> = {
  component: TagThenTextComponent,
  tags: ['autodocs'],
  args: { label: 'TagThenTextComponent' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Default: StoryObj<TagThenTextComponent> = {};
