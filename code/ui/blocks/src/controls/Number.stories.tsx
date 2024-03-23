import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { NumberControl } from './Number';

const meta = {
  component: NumberControl,
  tags: ['autodocs'],
  parameters: { withRawArg: 'value', controls: { include: ['value', 'min', 'max', 'step'] } },
  args: {
    name: 'number',
    onChange: fn(),
  },
} satisfies Meta<typeof NumberControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Undefined: Story = {
  args: { value: undefined },
};
// for security reasons a file input field cannot have an initial value, so it doesn't make sense to have stories for it

export const Ten: Story = {
  args: { value: 10 },
};
export const Zero: Story = {
  args: { value: 0 },
};

export const WithMin: Story = {
  args: { min: 1, value: 3 },
};
export const WithMax: Story = {
  args: { max: 7, value: 3 },
};
export const WithMinAndMax: Story = {
  args: { min: -2, max: 5, value: 3 },
};
export const LessThanMin: Story = {
  args: { min: 3, value: 1 },
};
export const MoreThanMax: Story = {
  args: { max: 3, value: 6 },
};

export const WithStep: Story = {
  args: { step: 5, value: 3 },
};

export const Readonly: Story = {
  args: {
    value: 3,
    argType: { table: { readonly: true } },
  },
};

export const ReadonlyAndUndefined: Story = {
  args: {
    value: undefined,
    argType: { table: { readonly: true } },
  },
};
