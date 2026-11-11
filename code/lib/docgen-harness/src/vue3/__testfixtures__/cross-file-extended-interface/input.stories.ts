import type { Meta, StoryObj } from '@storybook/vue3';

import ExtendedInterfaceProps from './ExtendedInterfaceProps.vue';

const meta = {
  title: 'VueFixtures/ExtendedInterfaceProps',
  component: ExtendedInterfaceProps,
} satisfies Meta<typeof ExtendedInterfaceProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { id: 7, name: 'Chained', extra: true },
};
