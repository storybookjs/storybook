import type { Meta, StoryObj } from '@storybook/vue3';

import UntypedSlots from './UntypedSlots.tsx';

const meta = {
  title: 'VueFixtures/TsxUntypedSlots',
  component: UntypedSlots,
} satisfies Meta<typeof UntypedSlots>;

export default meta;

type Story = StoryObj<typeof meta>;

// Slot args on an untyped TSX component: the docgen cannot categorize them as slots, so they
// fall through as plain attrs — the recording must contain no slot entries.
export const UntypedSlotArgs: Story = {
  args: {
    label: 'Card',
    default: () => 'fallback content',
  },
};
