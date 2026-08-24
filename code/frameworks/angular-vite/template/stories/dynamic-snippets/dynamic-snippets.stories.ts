import type { Meta, StoryObj } from '@storybook/angular-vite';

import { DynamicSnippetsComponent } from './dynamic-snippets.component';

const meta: Meta<DynamicSnippetsComponent> = {
  component: DynamicSnippetsComponent,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: { codePanel: true, canvas: { sourceState: 'shown' } },
  },
};

export default meta;

type Story = StoryObj<DynamicSnippetsComponent>;

export const Default: Story = {
  args: { label: 'declaredLabel' },
};
