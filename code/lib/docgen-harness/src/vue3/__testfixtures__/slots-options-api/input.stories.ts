import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';
// @ts-expect-error component doesn't have lang=ts
import OptionsApiSlots from './OptionsApiSlots.vue';

const meta = {
  title: 'VueFixtures/OptionsApiSlots',
  component: OptionsApiSlots,
} satisfies Meta<typeof OptionsApiSlots>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StringChild: Story = {
  args: { heading: 'Entries', default: 'Plain text content', header: 'Header text' },
};

export const ScopedBindings: Story = {
  args: {
    item: ({ entry, index }: { entry: string; index: number }) => h('em', `${index}: ${entry}`),
  },
};
