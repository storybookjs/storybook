import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './define-props/component.vue';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const RuntimeProps: Story = {
  args: {
    name: 'Ada Lovelace',
  },
};

export const RuntimePropsWithCategory: Story = {
  args: {
    name: 'Ada Lovelace',
    category: 'Content',
  },
};
