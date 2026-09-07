import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { OptionsControl } from './Options';

const arrayOptions = ['Bat', 'Cat', 'Rat'];
const labels = {
  Bat: 'Batwoman',
  Cat: 'Catwoman',
  Rat: 'Ratwoman',
};
// Only `Bat` is labelled; `Cat` and `Rat` should fall back to String(item).
const partialLabels = {
  Bat: 'Batwoman',
};
// Options that collide with Array.prototype method names — the regression case.
const prototypeCollisionOptions = ['reverse', 'map', 'filter'];
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

// Partial labels: only 'Bat' is mapped; 'Cat' and 'Rat' fall back to String(item).
export const ArrayLabelsPartial: Story = {
  args: {
    value: [arrayOptions[0]],
    labels: partialLabels,
  },
};

export const ArrayInlineLabelsPartial: Story = {
  args: {
    type: 'inline-check',
    value: [arrayOptions[1], arrayOptions[2]],
    labels: partialLabels,
  },
};

// Regression: when `labels` is emitted as an array by docgen (e.g. Svelte),
// options whose names match Array.prototype methods previously showed
// `function reverse() { [native code] }` instead of the option's string value.
// With the fix, each option must display as String(item) — 'reverse', 'map', 'filter'.
export const ArrayLabelsIsArray: Story = {
  name: 'Array Labels (docgen array — prototype-collision fix)',
  args: {
    value: [prototypeCollisionOptions[0]],
    argType: { options: prototypeCollisionOptions },
    labels: ['Reverse', 'Map', 'Filter'] as any,
  },
  argTypes: {
    value: {
      control: { type: 'check' },
      options: prototypeCollisionOptions,
    },
  },
};

export const ArrayInlineLabelsIsArray: Story = {
  name: 'Array Inline Labels (docgen array — prototype-collision fix)',
  args: {
    type: 'inline-check',
    value: [prototypeCollisionOptions[0], prototypeCollisionOptions[1]],
    argType: { options: prototypeCollisionOptions },
    labels: ['Reverse', 'Map', 'Filter'] as any,
  },
  argTypes: {
    value: {
      control: { type: 'inline-check' },
      options: prototypeCollisionOptions,
    },
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
