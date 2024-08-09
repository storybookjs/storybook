import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { OptionsControl } from './Options';

const arrayOptions = ['Bat', 'Cat', 'Rat'];
const labels = {
  Bat: 'Batwoman',
  Cat: 'Catwoman',
  Rat: 'Ratwoman',
};
const objectOptions = {
  A: { id: 'Aardvark' },
  B: { id: 'Bat' },
  C: { id: 'Cat' },
};

const meta = {
  title: 'Controls/Options/Check',
  component: OptionsControl,
  tags: ['autodocs'],
  parameters: {
    withRawArg: 'value',
    controls: { include: ['argType', 'type', 'value', 'labels'] },
  },
  args: {
    name: 'check',
    type: 'check',
    argType: { options: arrayOptions },
    onChange: fn(),
  },
  argTypes: {
    value: {
      control: { type: 'check' },
      options: arrayOptions,
    },
  },
} satisfies Meta<typeof OptionsControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Array: Story = {
  args: {
    value: [arrayOptions[0]],
  },
};

export const ArrayInline: Story = {
  args: {
    type: 'inline-check',
    value: [arrayOptions[1], arrayOptions[2]],
  },
};

export const ArrayLabels: Story = {
  args: {
    value: [arrayOptions[0]],
    labels,
  },
};

export const ArrayInlineLabels: Story = {
  args: {
    type: 'inline-check',
    value: [arrayOptions[1], arrayOptions[2]],
    labels,
  },
};

export const ArrayUndefined: Story = {
  args: {
    value: undefined,
  },
};

export const Object: Story = {
  name: 'DEPRECATED: Object',
  args: {
    value: [objectOptions.B],
    argType: { options: objectOptions },
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ObjectInline: Story = {
  name: 'DEPRECATED: Object Inline',
  args: {
    type: 'inline-check',
    value: [objectOptions.A, objectOptions.C],
    argType: { options: objectOptions },
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ObjectUndefined: Story = {
  name: 'DEPRECATED: Object Undefined',
  args: {
    value: undefined,
    argType: { options: objectOptions },
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ArrayReadonly: Story = {
  args: {
    value: [arrayOptions[0]],
    argType: {
      options: arrayOptions,
      table: {
        readonly: true,
      },
    },
  },
};
