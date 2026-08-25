import type { Meta, StoryObj } from '@storybook/vue3';

import IntersectionProps from './IntersectionProps.vue';

const meta = {
  title: 'VueFixtures/IntersectionProps',
  component: IntersectionProps,
} satisfies Meta<typeof IntersectionProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { mixed: { label: 'Intersected', count: 2, extra: true } },
};
