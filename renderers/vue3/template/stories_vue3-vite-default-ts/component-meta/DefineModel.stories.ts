import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './define-model/component.vue';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  args: {
    modelValue: 'Test value',
  },
};
