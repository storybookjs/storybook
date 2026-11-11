import type { Meta, StoryObj } from '@storybook/vue3';

import PropsUnionEnum from './PropsUnionEnum.vue';

const meta = {
  title: 'VueFixtures/PropsUnionEnum',
  component: PropsUnionEnum,
} satisfies Meta<typeof PropsUnionEnum>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { size: 'medium', status: 'ok' },
};
