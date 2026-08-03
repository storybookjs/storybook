import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn } from 'storybook/test';

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
// `Bat` key exists but has an undefined value — must fall back to String(item), not print "undefined".
const undefinedValueLabels: Record<string, string> = {
  Bat: undefined as any,
  Cat: 'Catwoman',
  Rat: 'Ratwoman',
};
// Options that collide with Array.prototype method names — the regression case.
const prototypeCollisionOptions = ['reverse', 'map', 'filter'];
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
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Batwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Catwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Ratwoman')).toBeInTheDocument();
  },
};

export const ArrayInlineLabels: Story = {
  args: {
    type: 'inline-radio',
    value: arrayOptions[1],
    labels,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Batwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Catwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Ratwoman')).toBeInTheDocument();
  },
};

// Partial labels: only 'Bat' is mapped; 'Cat' and 'Rat' fall back to String(item).
export const ArrayLabelsPartial: Story = {
  args: {
    value: arrayOptions[0],
    labels: partialLabels,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Batwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Cat')).toBeInTheDocument();
    await expect(canvas.getByText('Rat')).toBeInTheDocument();
  },
};

export const ArrayInlineLabelsPartial: Story = {
  args: {
    type: 'inline-radio',
    value: arrayOptions[1],
    labels: partialLabels,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Batwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Cat')).toBeInTheDocument();
    await expect(canvas.getByText('Rat')).toBeInTheDocument();
  },
};

// Regression guard: label key exists with value undefined — must NOT render the string "undefined".
export const ArrayLabelsUndefinedValue: Story = {
  name: 'Array Labels (undefined label value — must not render "undefined")',
  args: {
    value: arrayOptions[0],
    labels: undefinedValueLabels,
  },
  play: async ({ canvas }) => {
    // 'Bat' has an undefined label value → falls back to String(item)
    await expect(canvas.getByText('Bat')).toBeInTheDocument();
    await expect(canvas.getByText('Catwoman')).toBeInTheDocument();
    await expect(canvas.getByText('Ratwoman')).toBeInTheDocument();
    await expect(canvas.queryByText('undefined')).not.toBeInTheDocument();
  },
};

// Regression: when `labels` is emitted as an array by docgen (e.g. Svelte),
// options whose names match Array.prototype methods previously showed
// `function reverse() { [native code] }` instead of the option's string value.
// With the fix, each option must display as String(item) — 'reverse', 'map', 'filter'.
export const ArrayLabelsIsArray: Story = {
  name: 'Array Labels (docgen array — prototype-collision fix)',
  args: {
    value: prototypeCollisionOptions[0],
    argType: { options: prototypeCollisionOptions },
    labels: ['Reverse', 'Map', 'Filter'] as any,
  },
  argTypes: {
    value: {
      control: { type: 'radio' },
      options: prototypeCollisionOptions,
    },
  },
  play: async ({ canvas }: Parameters<NonNullable<Story['play']>>[0]) => {
    await expect(canvas.getByText('reverse')).toBeInTheDocument();
    await expect(canvas.getByText('map')).toBeInTheDocument();
    await expect(canvas.getByText('filter')).toBeInTheDocument();
    await expect(canvas.queryByText(/\[native code\]/)).not.toBeInTheDocument();
  },
};

export const ArrayInlineLabelsIsArray: Story = {
  name: 'Array Inline Labels (docgen array — prototype-collision fix)',
  args: {
    type: 'inline-radio',
    value: prototypeCollisionOptions[1],
    argType: { options: prototypeCollisionOptions },
    labels: ['Reverse', 'Map', 'Filter'] as any,
  },
  argTypes: {
    value: {
      control: { type: 'inline-radio' },
      options: prototypeCollisionOptions,
    },
  },
  play: async ({ canvas }: Parameters<NonNullable<Story['play']>>[0]) => {
    await expect(canvas.getByText('reverse')).toBeInTheDocument();
    await expect(canvas.getByText('map')).toBeInTheDocument();
    await expect(canvas.getByText('filter')).toBeInTheDocument();
    await expect(canvas.queryByText(/\[native code\]/)).not.toBeInTheDocument();
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
