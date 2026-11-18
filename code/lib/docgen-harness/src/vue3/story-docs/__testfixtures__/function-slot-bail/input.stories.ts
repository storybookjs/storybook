import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import ChildButton from './ChildButton.vue';
import FunctionSlotBailPanel from './FunctionSlotBailPanel.vue';

const meta = {
  component: FunctionSlotBailPanel,
  title: 'Forms/function-slot-bail',
} satisfies Meta<typeof FunctionSlotBailPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The default slot renders, but the scoped footer slot bails the whole snippet. */
export const Primary: Story = {
  args: {
    default: () => h(ChildButton, { label: 'Click me' }),
    footer: ({ note }: { note: string }) => `Note: ${note}`,
  },
};
