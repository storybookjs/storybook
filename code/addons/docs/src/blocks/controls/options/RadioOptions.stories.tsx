import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

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
  title: 'Controls/Options/Radio',
  component: OptionsControl,
  tags: ['autodocs'],
  parameters: {
    withRawArg: 'value',
    controls: { include: ['argType', 'type', 'value', 'labels'] },
  },
  args: {
    name: 'radio',
    type: 'radio',
    argType: { options: arrayOptions },
    onChange: fn(),
  },
  argTypes: {
    value: {
      control: { type: 'radio' },
      options: arrayOptions,
    },
  },
} satisfies Meta<typeof OptionsControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Array: Story = {
  args: {
    value: arrayOptions[0],
  },
};

export const ArrayInline: Story = {
  args: {
    type: 'inline-radio',
    value: arrayOptions[1],
  },
};

export const ArrayLabels: Story = {
  args: {
    value: arrayOptions[0],
    labels,
  },
};

export const ArrayInlineLabels: Story = {
  args: {
    type: 'inline-radio',
    value: arrayOptions[1],
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
    value: objectOptions.B,
    argType: { options: objectOptions },
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ObjectInline: Story = {
  name: 'DEPRECATED: Object Inline',
  args: {
    type: 'inline-radio',
    value: objectOptions.A,
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

// Regression test for https://github.com/storybookjs/storybook/issues/30142
// Options whose names match Array prototype methods (e.g. 'reverse') must be
// displayed as plain text, not as the stringified native function.
const optionsWithArrayMethodNames = ['normal', 'reverse', 'filter', 'map'];
export const ArrayWithBuiltinNames: Story = {
  name: 'Array with option names matching built-in Array methods',
  args: {
    value: optionsWithArrayMethodNames[0],
    argType: { options: optionsWithArrayMethodNames },
  },
};

// Reproduces the exact bug from issue #30142: when `labels` is inadvertently an array
// (instead of a Record), `labels?.['reverse']` resolves to `Array.prototype.reverse` — a
// truthy native function — causing the label to render as "function reverse() { [native code] }".
export const ArrayWithBuiltinNamesAndArrayLabels: Story = {
  name: 'Array with built-in names and labels accidentally passed as array (bug #30142)',
  args: {
    value: optionsWithArrayMethodNames[0],
    argType: { options: optionsWithArrayMethodNames },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: optionsWithArrayMethodNames as any,
  },
};
