import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TextControl } from './Text';

const meta = {
  component: TextControl,
  tags: ['autodocs'],
  parameters: { withRawArg: 'value', controls: { include: ['value', 'maxLength'] } },
  args: {
    name: 'text',
    onChange: fn(),
  },
} satisfies Meta<typeof TextControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    value: 'Storybook says hi. 👋',
  },
};

export const Empty: Story = {
  args: {
    value: '',
  },
};

export const Undefined: Story = {
  args: {
    value: undefined,
  },
};

export const WithMaxLength: Story = {
  args: {
    value: "You can't finish this sente",
    maxLength: 28,
  },
};

export const BasicReadonly: Story = {
  args: {
    value: 'Storybook says hi. 👋',
    argType: {
      table: {
        readonly: true,
      },
    },
  },
};

export const UndefinedReadonly: Story = {
  args: {
    value: undefined,
    argType: {
      table: {
        readonly: true,
      },
    },
  },
};
