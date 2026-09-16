import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import TypedSlots from './TypedSlots.tsx';

const meta = {
  title: 'VueFixtures/TsxTypedSlots',
  component: TypedSlots,
} satisfies Meta<typeof TypedSlots>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TypedSlotArgs: Story = {
  args: {
    label: 'Card',
    default: ({ content }: { content: string }) => h('p', content),
    header: ({ title }: { title: string }) => h('h2', title),
  },
};
