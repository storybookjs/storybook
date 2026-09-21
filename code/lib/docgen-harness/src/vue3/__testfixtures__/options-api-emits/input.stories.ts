import type { Meta, StoryObj } from '@storybook/vue3';

import OptionsApiEmits from './OptionsApiEmits.vue';

const meta = {
  title: 'VueFixtures/OptionsApiEmits',
  component: OptionsApiEmits,
} satisfies Meta<typeof OptionsApiEmits>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Stepper: Story = {
  args: { step: 2 },
};
