import type { Meta, StoryObj } from '@storybook/vue3';

import ExposeEventCollision from './ExposeEventCollision.vue';

const meta = {
  title: 'VueFixtures/ExposeEventCollision',
  component: ExposeEventCollision,
} satisfies Meta<typeof ExposeEventCollision>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { label: 'Name' },
};
