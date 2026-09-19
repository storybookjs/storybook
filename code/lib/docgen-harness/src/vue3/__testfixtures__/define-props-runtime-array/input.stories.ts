import type { Meta, StoryObj } from '@storybook/vue3';

import RuntimeArrayProps from './RuntimeArrayProps.vue';

const meta = {
  title: 'VueFixtures/RuntimeArrayProps',
  component: RuntimeArrayProps,
} satisfies Meta<typeof RuntimeArrayProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { appearance: 'primary', label: 'Go' },
};
