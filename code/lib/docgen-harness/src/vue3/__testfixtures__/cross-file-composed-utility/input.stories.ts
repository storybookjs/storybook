import type { Meta, StoryObj } from '@storybook/vue3';

import UtilityComposedProps from './UtilityComposedProps.vue';

const meta = {
  title: 'VueFixtures/UtilityComposedProps',
  component: UtilityComposedProps,
} satisfies Meta<typeof UtilityComposedProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Picked' },
};
