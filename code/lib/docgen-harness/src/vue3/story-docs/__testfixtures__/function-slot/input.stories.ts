import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import ChildButton from './ChildButton.vue';
import FunctionSlotPanel from './FunctionSlotPanel.vue';

const meta = {
  component: FunctionSlotPanel,
  title: 'Forms/function-slot',
} satisfies Meta<typeof FunctionSlotPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    default: () => h(ChildButton, { label: 'Click me' }),
  },
};
