import type { Meta, StoryObj } from '@storybook/vue3';

import DefineExpose from './DefineExpose.vue';

const meta = {
  title: 'VueFixtures/DefineExpose',
  component: DefineExpose,
} satisfies Meta<typeof DefineExpose>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: {
    label: 'Increment',
  },
};
