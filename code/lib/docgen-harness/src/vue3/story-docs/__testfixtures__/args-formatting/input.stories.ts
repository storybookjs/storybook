import type { Meta, StoryObj } from '@storybook/vue3';

import ArgsFormattingButton from './ArgsFormattingButton.vue';

const meta = {
  component: ArgsFormattingButton,
  title: 'Forms/args-formatting',
} satisfies Meta<typeof ArgsFormattingButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Formatted',
    quotationLabel: 'She said "hi" and it\'s fine',
    emptyLabel: '',
    enabled: true,
    disabled: false,
    count: 3,
    options: { tone: 'neutral', compact: true },
    items: ['one', 'two'],
    onSubmit: () => undefined,
  },
};

export const UnsetArg: Story = {
  args: {
    label: undefined,
    count: 3,
  },
};
