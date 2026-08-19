import type { Meta, StoryObj } from '@storybook/vue3';

import DestructuredProps from './DestructuredProps.vue';

const meta = {
  title: 'VueFixtures/DestructuredProps',
  component: DestructuredProps,
} satisfies Meta<typeof DestructuredProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Sized', size: 'large' },
};
