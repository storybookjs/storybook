import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import HArgsExpression from './HArgsExpression.vue';

const meta = {
  component: HArgsExpression,
  title: 'Forms/h-args-expression',
} satisfies Meta<typeof HArgsExpression>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    count: 2,
  },
  render: (args) => h(HArgsExpression, { count: args.count + 1, label: `${args.count} items` }),
};
