import type { Meta, StoryObj } from '@storybook/vue3';

import VModelInput from './VModelInput.vue';

const meta = {
  title: 'VueFixtures/VModelInput',
  component: VModelInput,
} satisfies Meta<typeof VModelInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VModelBinding: Story = {
  args: { modelValue: 'typed text', checked: true },
};
