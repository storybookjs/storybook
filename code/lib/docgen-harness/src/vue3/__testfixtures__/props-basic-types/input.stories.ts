import type { Meta, StoryObj } from '@storybook/vue3';

import PropsBasicTypes from './PropsBasicTypes.vue';

const meta = {
  title: 'VueFixtures/PropsBasicTypes',
  component: PropsBasicTypes,
} satisfies Meta<typeof PropsBasicTypes>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Hello', count: 2, enabled: true },
};

export const UnrepresentableArgs: Story = {
  args: {
    label: 'Formatted',
    tags: ['alpha', 'beta'],
    config: { theme: 'dark', dense: true },
    formatter: (value: number) => `#${value}`,
    token: Symbol('fixture'),
    big: BigInt('9007199254740993'),
  },
};
