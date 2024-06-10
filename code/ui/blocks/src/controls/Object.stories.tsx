import type { Meta, StoryObj } from '@storybook/react';
import { ObjectControl } from './Object';
import { fn } from '@storybook/test';

const meta = {
  component: ObjectControl,
  tags: ['autodocs'],
  parameters: { withRawArg: 'value', controls: { include: ['value'] } },
  args: {
    name: 'object',
    onChange: fn(),
  },
} satisfies Meta<typeof ObjectControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Object: Story = {
  args: {
    value: {
      name: 'Michael',
      someDate: new Date('2022-10-30T12:31:11'),
      nested: { someBool: true, someNumber: 22 },
    },
  },
};

export const Array: Story = {
  args: {
    value: [
      'someString',
      22,
      true,
      new Date('2022-10-30T12:31:11'),
      { someBool: true, someNumber: 22 },
    ],
  },
};

export const EmptyObject: Story = {
  args: {
    value: {},
  },
};

export const EmptyArray: Story = {
  args: {
    value: {},
  },
};

export const Null: Story = {
  args: {
    value: null,
  },
};

export const Undefined: Story = {
  args: {
    value: undefined,
  },
};

class Person {
  constructor(
    public firstName: string,
    public lastName: string
  ) {}

  fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}

/**
 * We show a class collapsed as it might contain many methods.
 * It is read-only as we can not construct the class.
 */
export const Class: Story = {
  args: {
    value: new Person('Kasper', 'Peulen'),
  },
};

/**
 * We show a function collapsed. Even if it is "object" like, such as "fn".
 * It is read-only as we can not construct a function.
 */
export const Function: Story = {
  args: {
    value: fn(),
  },
};

export const Readonly: Story = {
  args: {
    value: {
      name: 'Michael',
      someDate: new Date('2022-10-30T12:31:11'),
      nested: { someBool: true, someNumber: 22 },
    },
    argType: { table: { readonly: true } },
  },
};

export const ReadonlyAndUndefined: Story = {
  args: {
    value: undefined,
    argType: { table: { readonly: true } },
  },
};
