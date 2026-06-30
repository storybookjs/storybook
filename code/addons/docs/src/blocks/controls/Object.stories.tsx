import React, { useEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, waitFor } from 'storybook/test';

import { ObjectControl } from './Object';

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

export const DelayedObject: Story = {
  render: (args) => {
    const [value, setValue] = useState<object | undefined>(undefined);

    useEffect(() => {
      setTimeout(() => {
        setValue({
          name: 'Michael',
          nested: { someBool: true, someNumber: 22 },
        });
      }, 1_000);
    }, []);

    return <ObjectControl {...args} value={value} />;
  },
  parameters: {
    withRawArg: false,
  },
  play: async ({ canvas }) => {
    await canvas.findByText('"Michael"');
    await waitFor(() => {
      expect(
        canvas.queryByRole('textbox', { name: 'Edit object as JSON' })
      ).not.toBeInTheDocument();
    });
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
 * We show a class collapsed as it might contain many methods. It is read-only as we can not
 * construct the class.
 */
export const Class: Story = {
  args: {
    value: new Person('Kasper', 'Peulen'),
  },
};

/**
 * We show a function collapsed. Even if it is "object" like, such as "fn". It is read-only as we
 * can not construct a function.
 */
export const Function: Story = {
  args: {
    value: fn(),
  },
};

/**
 * Some renderers (e.g. Vue) pass non-serializable, circular values as args — a VNode's `el`
 * references back to the VNode via `__vnode`. Such values cannot be edited as JSON, so the control
 * shows a read-only best-effort view instead of crashing the panel with "Converting circular
 * structure to JSON".
 */
export const CircularReference: Story = {
  args: {
    value: (() => {
      const el: any = {};
      const vnode: any = { __v_isVNode: true, type: 'p', props: null, children: 'Footer', el };
      el.__vnode = vnode;
      return vnode;
    })(),
  },
  play: async ({ canvas }) => {
    // Rendered read-only (no editable JSON tree, no crash); circular refs shown as [Circular].
    const textbox = await canvas.findByRole('textbox', { name: 'Edit object as JSON' });
    await expect(textbox).toHaveAttribute('readonly');
    await expect((textbox as HTMLTextAreaElement).value).toContain('[Circular]');
    // The edit-as-JSON toggle is disabled and explains why the value can't be edited.
    const editButton = await canvas.findByLabelText(
      'Args with circular references cannot be edited.'
    );
    await expect(editButton).toHaveAttribute('aria-disabled', 'true');
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

export const ObjectSmallViewport: Story = {
  args: {
    value: {
      name: 'Michael',
      someDate: new Date('2022-10-30T12:31:11'),
      nested: { someBool: true, someNumber: 22 },
    },
  },
  parameters: {
    chromatic: { viewports: [320] },
  },
};

export const ArraySmallViewport: Story = {
  args: {
    value: [
      'someString',
      22,
      true,
      new Date('2022-10-30T12:31:11'),
      { someBool: true, someNumber: 22 },
    ],
  },
  parameters: {
    chromatic: { viewports: [320] },
  },
};
