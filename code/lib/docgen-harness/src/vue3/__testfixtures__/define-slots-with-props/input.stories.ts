import type { Meta, StoryObj } from '@storybook/vue3';

import DefineSlotsWithProps from './DefineSlotsWithProps.vue';

const meta = {
  title: 'VueFixtures/DefineSlotsWithProps',
  component: DefineSlotsWithProps,
} satisfies Meta<typeof DefineSlotsWithProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: {
    label: 'Save',
    disabled: true,
  },
};
