import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateOnlySlots from './TemplateOnlySlots.vue';

const meta = {
  title: 'VueFixtures/TemplateOnlySlots',
  component: TemplateOnlySlots,
} satisfies Meta<typeof TemplateOnlySlots>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StringChild: Story = {
  args: { default: 'Plain text content', header: 'Header text' },
};

export const ScopedBindings: Story = {
  args: {
    item: ({ entry, index }: { entry: string; index: number }) => h('em', `${index}: ${entry}`),
  },
};
