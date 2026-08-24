import type { Meta, StoryObj } from '@storybook/vue3';

import RuntimeMultiConstructor from './RuntimeMultiConstructor.vue';

const meta = {
  title: 'VueFixtures/RuntimeMultiConstructor',
  component: RuntimeMultiConstructor,
} satisfies Meta<typeof RuntimeMultiConstructor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { width: 200 },
};
