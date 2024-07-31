import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { RangeControl } from './Range';

const meta = {
  component: RangeControl,
  tags: ['autodocs'],
  parameters: { withRawArg: 'value', controls: { include: ['value', 'min', 'max', 'step'] } },
  args: {
    name: 'range',
    onChange: fn(),
  },
} satisfies Meta<typeof RangeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Undefined: Story = {
  args: {
    value: undefined,
  },
};

export const Zero: Story = {
  args: {
    value: 0,
  },
};

export const WithMin: Story = {
  args: {
    min: 5,
    value: 20,
  },
};

export const WithMax: Story = {
  args: {
    max: 50,
    value: 20,
  },
};

export const WithBigMax: Story = {
  args: {
    max: 10000000000,
    value: 20,
  },
};

export const WithMinAndMax: Story = {
  args: {
    min: 10,
    max: 50,
    value: 20,
  },
};

export const LessThanMin: Story = {
  args: {
    min: 10,
    value: 5,
  },
};

export const MoreThanMax: Story = {
  args: {
    max: 20,
    value: 50,
  },
};

export const WithSteps: Story = {
  args: {
    step: 5,
    value: 50,
  },
};

export const Decimals: Story = {
  args: {
    step: 0.000000000002,
    value: 989.123123123123,
    max: 2000,
  },
};
export const WithInfiniteMax: Story = {
  args: {
    max: Infinity,
    value: 50,
  },
};

export const Readonly: Story = {
  args: {
    value: 40,
    argType: {
      table: {
        readonly: true,
      },
    },
  },
};
