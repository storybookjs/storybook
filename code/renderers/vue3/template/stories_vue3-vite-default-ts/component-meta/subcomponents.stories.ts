import type { Meta, StoryObj } from '@storybook/vue3';

import { Parts } from './subcomponents/barrel';

// The component and its subcomponent come from a barrel's `export * as`, for the docgen baselines.
const meta = {
  component: Parts.Model,
  subcomponents: { Props: Parts.Props },
  tags: ['autodocs'],
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof Parts.Model>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  args: {
    modelValue: 'Test value',
  },
};
