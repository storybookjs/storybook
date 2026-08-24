import type { Meta, StoryObj } from '@storybook/vue3';

import RuntimeObjectProps from './RuntimeObjectProps.vue';

const meta = {
  title: 'VueFixtures/RuntimeObjectProps',
  component: RuntimeObjectProps,
} satisfies Meta<typeof RuntimeObjectProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Total', count: 3 },
};
