import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, userEvent } from 'storybook/test';

import { OptionsControl } from './Options';

const arrayOptions = ['Bat', 'Cat', 'Rat'];
const objectOptions = {
  A: { id: 'Aardvark' },
  B: { id: 'Bat' },
  C: { id: 'Cat' },
};
const labels = {
  Bat: 'Batwoman',
  Cat: 'Catwoman',
  Rat: 'Ratwoman',
};
// Only `Bat` is labelled; `Cat` and `Rat` should fall back to String(item).
const partialLabels = {
  Bat: 'Batwoman',
};
// Option names that collide with Array.prototype method names.
// When `labels` is mistakenly emitted as an array (e.g. by Svelte docgen),
// the old code resolved e.g. labels['reverse'] → Array.prototype.reverse
// (a native function string). The fix must show 'reverse', 'map', 'filter'.
const prototypeCollisionOptions = ['reverse', 'map', 'filter'];
const argTypeMultiSelect = {
  argTypes: {
    value: {
      control: { type: 'multi-select' },
      options: arrayOptions,
    },
  },
} as const;

const meta = {
  title: 'Controls/Options/Select',
  component: OptionsControl,
  tags: ['autodocs'],
  parameters: {
    withRawArg: 'value',
    controls: { include: ['argType', 'type', 'value', 'labels'] },
  },
  args: {
    name: 'select',
    type: 'select',
    argType: { options: arrayOptions },
    onChange: fn(),
  },
  argTypes: {
    value: {
      control: { type: 'select' },
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

export const ArrayMulti: Story = {
  args: {
    type: 'multi-select',
    value: [arrayOptions[1], arrayOptions[2]],
  },
  ...argTypeMultiSelect,
};

export const ArrayUndefined: Story = {
  args: {
    value: undefined,
  },
};

export const ArrayResettable: Story = {
  args: {
    value: undefined,
  },
  play: async ({ canvas, args }) => {
    const select = canvas.getByRole('combobox');
    expect(select).toHaveValue('Choose option...');

    await userEvent.click(select);
    await userEvent.selectOptions(select, arrayOptions[2]);

    expect(args.onChange).toHaveBeenCalledWith(arrayOptions[2]);
    expect(select).toHaveValue(arrayOptions[2]);

    await userEvent.click(select);
    await userEvent.selectOptions(select, 'Choose option...');

    expect(args.onChange).toHaveBeenCalledWith(undefined);
    expect(select).toHaveValue('Choose option...');
  },
};

export const ArrayMultiUndefined: Story = {
  args: {
    type: 'multi-select',
    value: undefined,
  },
  ...argTypeMultiSelect,
};

export const ArrayLabels: Story = {
  args: {
    value: arrayOptions[0],
    labels,
  },
};

export const ArrayMultiLabels: Story = {
  args: {
    type: 'multi-select',
    value: [arrayOptions[1], arrayOptions[2]],
    labels,
  },
  ...argTypeMultiSelect,
};

// Partial labels: only 'Bat' is mapped; 'Cat' and 'Rat' fall back to String(item).
export const ArrayLabelsPartial: Story = {
  args: {
    value: arrayOptions[0],
    labels: partialLabels,
  },
};

export const ArrayMultiLabelsPartial: Story = {
  args: {
    type: 'multi-select',
    value: [arrayOptions[1], arrayOptions[2]],
    labels: partialLabels,
  },
  ...argTypeMultiSelect,
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
      control: { type: 'select' },
      options: prototypeCollisionOptions,
    },
  },
};

export const ArrayMultiLabelsIsArray: Story = {
  name: 'Array Multi Labels (docgen array — prototype-collision fix)',
  args: {
    type: 'multi-select',
    value: [prototypeCollisionOptions[0], prototypeCollisionOptions[1]],
    argType: { options: prototypeCollisionOptions },
    labels: ['Reverse', 'Map', 'Filter'] as any,
  },
  argTypes: {
    value: {
      control: { type: 'multi-select' },
      options: prototypeCollisionOptions,
    },
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

export const ObjectMulti: Story = {
  name: 'DEPRECATED: Object Multi',
  args: {
    type: 'multi-select',
    value: [objectOptions.A, objectOptions.B],
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

export const ObjectMultiUndefined: Story = {
  name: 'DEPRECATED: Object Multi Undefined',
  args: {
    type: 'multi-select',
    value: undefined,
    argType: { options: objectOptions },
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ArrayReadonly: Story = {
  args: {
    value: arrayOptions[0],
    argType: {
      options: arrayOptions,
      table: {
        readonly: true,
      },
    },
  },
  argTypes: {
    value: {
      control: { type: 'select' },
      options: arrayOptions,
    },
  },
};

export const ArrayMultiReadonly: Story = {
  args: {
    type: 'multi-select',
    value: [arrayOptions[1], arrayOptions[2]],
    argType: {
      options: arrayOptions,
      table: {
        readonly: true,
      },
    },
  },
  ...argTypeMultiSelect,
};
