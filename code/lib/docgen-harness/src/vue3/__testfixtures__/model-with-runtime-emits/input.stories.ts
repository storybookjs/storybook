import type { Meta, StoryObj } from '@storybook/vue3';

import ModelWithRuntimeEmits from './ModelWithRuntimeEmits.vue';

const meta = {
  title: 'VueFixtures/ModelWithRuntimeEmits',
  component: ModelWithRuntimeEmits,
} satisfies Meta<typeof ModelWithRuntimeEmits>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Bound: Story = {
  args: { modelValue: 'draft' },
};
