import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import DefineSlotsLiteralBindings from './DefineSlotsLiteralBindings.vue';

const meta = {
  title: 'VueFixtures/DefineSlotsLiteralBindings',
  component: DefineSlotsLiteralBindings,
} satisfies Meta<typeof DefineSlotsLiteralBindings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ScopedIconBinding: Story = {
  args: {
    default: 'Save',
    icon: ({ size, fill }: { size: 'md'; fill: 'currentColor' }) => h('i', `${size} ${fill}`),
  },
};
