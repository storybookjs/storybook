import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import SlotsShowcase from './SlotsShowcase.vue';

const meta = {
  title: 'VueFixtures/SlotsShowcase',
  component: SlotsShowcase,
} satisfies Meta<typeof SlotsShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StringChild: Story = {
  args: { heading: 'Plain', default: 'Plain text content' },
};

export const VNodeChild: Story = {
  args: {
    heading: 'Structured',
    header: () => h('strong', 'Header content'),
    default: () => h('p', { class: 'body' }, 'Body content'),
  },
};

export const ScopedBindings: Story = {
  args: {
    heading: 'Scoped',
    item: ({ entry, index }: { entry: { label: string }; index: number }) =>
      h('em', `${index}: ${entry.label}`),
  },
};
