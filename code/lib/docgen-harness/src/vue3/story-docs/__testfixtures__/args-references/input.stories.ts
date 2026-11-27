import type { Meta, StoryObj } from '@storybook/vue3';

import ArgsReferencesButton from './ArgsReferencesButton.vue';

const SOME_CONST = 'Declared label';
const BASE_OPTIONS = { size: 'md' };

const meta = {
  component: ArgsReferencesButton,
  title: 'Forms/args-references',
} satisfies Meta<typeof ArgsReferencesButton>;

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

export const UnreadableSpreadArg: Story = {
  args: {
    options: { ...buildOptions(), tone: 'neutral' },
  },
};

declare function buildOptions(): { size: string };
