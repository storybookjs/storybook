import type { Meta, StoryObj } from '@storybook/vue3';

import RuntimePropTypeCast from './RuntimePropTypeCast.vue';

const meta = {
  title: 'VueFixtures/RuntimePropTypeCast',
  component: RuntimePropTypeCast,
} satisfies Meta<typeof RuntimePropTypeCast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { kind: 'secondary', measure: 42 },
};
