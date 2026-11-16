import type { Meta, StoryObj } from '@storybook/angular-vite';

import { Docs } from './barrel';

// The component and its subcomponent come from a barrel's `export * as`, for the docgen baselines.
const meta: Meta<Docs.DocButtonComponent<unknown>> = {
  component: Docs.DocButtonComponent,
  subcomponents: { DocDirective: Docs.DocDirective },
  parameters: { chromatic: { disableSnapshot: true } },
};

export default meta;

type Story = StoryObj<Docs.DocButtonComponent<unknown>>;

export const Basic: Story = {
  args: { label: 'Subcomponents' },
};
