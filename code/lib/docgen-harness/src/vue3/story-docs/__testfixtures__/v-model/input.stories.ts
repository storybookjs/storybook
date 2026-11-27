import type { Meta, StoryObj } from '@storybook/vue3';

import ModelToggle from './ModelToggle.vue';

const meta = {
  component: ModelToggle,
  title: 'Forms/v-model',
} satisfies Meta<typeof ModelToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    modelValue: 'Accepted',
    checked: true,
  },
};
