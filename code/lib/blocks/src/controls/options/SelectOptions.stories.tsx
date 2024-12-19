import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

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
    argType: {
      options: arrayOptions,
    },
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

export const Object: Story = {
  name: 'DEPRECATED: Object',
  args: {
    value: objectOptions.B,
    argType: { options: objectOptions as any },
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ObjectMulti: Story = {
  name: 'DEPRECATED: Object Multi',
  args: {
    type: 'multi-select',
    value: [objectOptions.A, objectOptions.B],
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ObjectUndefined: Story = {
  name: 'DEPRECATED: Object Undefined',
  args: {
    value: undefined,
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ObjectMultiUndefined: Story = {
  name: 'DEPRECATED: Object Multi Undefined',
  args: {
    type: 'multi-select',
    value: undefined,
  },
  argTypes: { value: { control: { type: 'object' } } },
};

export const ArrayReadonly: Story = {
  args: {
    value: arrayOptions[0],
    argType: {
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
      table: {
        readonly: true,
      },
    },
  },
  ...argTypeMultiSelect,
};
