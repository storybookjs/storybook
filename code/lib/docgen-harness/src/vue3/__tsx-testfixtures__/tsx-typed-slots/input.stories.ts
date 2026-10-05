import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

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
    // Optional slot members give the payload a `| undefined` union, so slot functions that
    // want vue-tsc-clean typing must either tolerate it or ignore the payload entirely.
    // The payload contract is asserted in extractArgTypes.test.ts.
    default: () => [h('p', 'fallback content')],
    header: () => [h('h2', 'fallback title')],
  },
};
