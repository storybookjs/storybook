import type { Meta, StoryObj } from '@storybook/vue3';

import SlotsWithEvents from './SlotsWithEvents.vue';

const meta = {
  title: 'VueFixtures/SlotsWithEvents',
  component: SlotsWithEvents,
} satisfies Meta<typeof SlotsWithEvents>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StringChild: Story = {
  args: { title: 'Notice', leading: '!', default: 'Body text' },
};
