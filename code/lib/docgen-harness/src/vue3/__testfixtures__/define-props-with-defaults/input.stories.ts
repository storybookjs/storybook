import type { Meta, StoryObj } from '@storybook/vue3';

import DefinePropsWithDefaults from './DefinePropsWithDefaults.vue';

const meta = {
  title: 'VueFixtures/DefinePropsWithDefaults',
  component: DefinePropsWithDefaults,
} satisfies Meta<typeof DefinePropsWithDefaults>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Custom label', size: 'large', disabled: true },
};
