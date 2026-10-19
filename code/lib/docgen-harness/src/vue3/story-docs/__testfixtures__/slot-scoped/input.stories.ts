import type { Meta, StoryObj } from '@storybook/vue3';

import ScopedList from './ScopedList.vue';

const meta = {
  component: ScopedList,
  title: 'Forms/slot-scoped',
} satisfies Meta<typeof ScopedList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Alpha',
    item: ({ label }: { label: string }) => `Row: ${label}`,
  },
};
