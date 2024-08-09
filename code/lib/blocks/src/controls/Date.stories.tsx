import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { DateControl } from './Date';

const meta = {
  component: DateControl,
  tags: ['autodocs'],
  parameters: { withRawArg: 'value', controls: { include: ['value'] } },
  argTypes: {
    value: {
      description: 'The date',
      control: { type: 'date' },
    },
  },
  args: { name: 'date', onChange: fn() },
} satisfies Meta<typeof DateControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: { value: new Date('2020-10-20T09:30:02') },
};

export const Undefined: Story = {
  args: { value: undefined },
};

export const Readonly: Story = {
  args: {
    value: new Date('2020-10-20T09:30:02'),
    argType: { table: { readonly: true } },
  },
};
