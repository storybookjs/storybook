import type { Meta, StoryObj } from '@storybook/vue3';

import RecursiveTree from './RecursiveTree.vue';

const meta = {
  title: 'VueFixtures/RecursiveTree',
  component: RecursiveTree,
} satisfies Meta<typeof RecursiveTree>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: {
    node: {
      value: 'root',
      children: [{ value: 'leaf', children: [] }],
    },
  },
};
