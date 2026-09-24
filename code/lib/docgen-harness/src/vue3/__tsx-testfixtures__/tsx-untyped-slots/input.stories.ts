import type { Meta, StoryObj } from '@storybook/vue3-vite';

import UntypedSlots from './UntypedSlots.tsx';

const meta = {
  title: 'VueFixtures/TsxUntypedSlots',
  component: UntypedSlots,
} satisfies Meta<typeof UntypedSlots>;

export default meta;

type Story = StoryObj<typeof meta>;

// Slot args on an untyped TSX component: the docgen cannot categorize them as slots, so they
// fall through as plain attrs — the recording must contain no slot entries. The cast mirrors
// what the type system sees: on an untyped component a slot is just an unknown property.
const untypedSlotArgs = {
  label: 'Card',
  default: () => 'fallback content',
} satisfies Record<string, unknown>;

export const UntypedSlotArgs: Story = {
  args: untypedSlotArgs as Story['args'],
};
