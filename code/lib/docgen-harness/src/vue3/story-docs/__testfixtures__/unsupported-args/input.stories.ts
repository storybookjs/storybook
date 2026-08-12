import type { Meta, StoryObj } from '@storybook/vue3';

import UnsupportedArgsButton from './UnsupportedArgsButton.vue';

const SOME_CONST = 'Imported label';
const BASE_OPTIONS = { size: 'md' };

const meta = {
  component: UnsupportedArgsButton,
  title: 'Forms/unsupported-args',
} satisfies Meta<typeof UnsupportedArgsButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IdentifierArg: Story = {
  args: {
    label: SOME_CONST,
  },
};

export const SpreadObjectArg: Story = {
  args: {
    options: { ...BASE_OPTIONS, tone: 'neutral' },
  },
};
