import React, { useEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { destroyAnnouncer } from '@react-aria/live-announcer';

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
  beforeEach: async () => {
    destroyAnnouncer();
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
    value: [],
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
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Set object' });
    await expect(button).toBeVisible();
    await userEvent.click(button);
    await expect(args.onChange).toHaveBeenCalledWith({});
  },
};

export const UndefinedArray: Story = {
  args: {
    value: undefined,
    argType: { type: { name: 'array', value: { name: 'string' } } },
  },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Set array' });
    await expect(button).toBeVisible();
    await userEvent.click(button);
    await expect(args.onChange).toHaveBeenCalledWith([]);
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
    // The value renders after a 1s delay, which races findByText's default 1s timeout
    await canvas.findByText('"Michael"', undefined, { timeout: 5000 });
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
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'Edit object as JSON' })).toHaveValue('');
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

const invalidJson = /^Invalid JSON: /;

/** A parse error is raised when the raw editor is left, not while typing in it. */
export const JsonEditorValidation: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ args, canvas, step, userEvent }) => {
    await userEvent.click(canvas.getByRole('switch', { name: 'Edit object as JSON' }));
    const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });

    await step('Typing invalid JSON raises no error', async () => {
      await userEvent.clear(rawInput);
      await userEvent.type(rawInput, '{{"label":');

      await expect(rawInput).toHaveFocus();
      await expect(rawInput).not.toHaveAttribute('aria-invalid');
      await expect(rawInput).not.toHaveAccessibleDescription();
      await expect(document.body).not.toHaveLiveRegion({ text: invalidJson });
    });

    await step('Leaving the editor raises the error and announces it politely', async () => {
      await userEvent.tab();

      await expect(rawInput).not.toHaveFocus();
      await expect(rawInput).toHaveAttribute('aria-invalid', 'true');
      await expect(rawInput).toHaveAccessibleDescription(invalidJson);
      await expect(canvas.getByText(invalidJson)).toBeVisible();
      await waitFor(() =>
        expect(document.body).toHaveLiveRegion({ text: invalidJson, level: 'polite' })
      );
      await expect(document.body).not.toHaveLiveRegion({ text: invalidJson, level: 'assertive' });
      await expect(args.onChange).not.toHaveBeenCalled();
    });

    await step('The error clears as soon as the JSON is valid again', async () => {
      await userEvent.type(rawInput, '"updated"}');

      await expect(rawInput).toHaveFocus();
      await expect(rawInput).not.toHaveAttribute('aria-invalid');
      await expect(rawInput).not.toHaveAccessibleDescription();
      await expect(canvas.queryByText(invalidJson)).not.toBeInTheDocument();
      await expect(args.onChange).not.toHaveBeenCalled();
    });

    await step('Leaving the editor commits valid JSON', async () => {
      await userEvent.tab();

      await expect(args.onChange).toHaveBeenCalledTimes(1);
      await expect(args.onChange).toHaveBeenCalledWith({ label: 'updated' });
    });
  },
};

/** Closing the raw editor discards a draft that failed to parse, along with its error. */
export const JsonEditorErrorReset: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ args, canvas, step, userEvent }) => {
    const toggle = canvas.getByRole('switch', { name: 'Edit object as JSON' });

    await step('Raise a parse error', async () => {
      await userEvent.click(toggle);
      const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });
      await userEvent.clear(rawInput);
      await userEvent.type(rawInput, '{{"label":');
      await userEvent.tab();

      await expect(rawInput).toHaveAttribute('aria-invalid', 'true');
    });

    await step('Close and reopen the raw editor', async () => {
      await userEvent.click(toggle);
      await expect(canvas.queryByText(invalidJson)).not.toBeInTheDocument();
      await userEvent.click(toggle);

      const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });
      await expect(rawInput).toHaveValue(JSON.stringify(args.value, null, 2));
      await expect(rawInput).not.toHaveAttribute('aria-invalid');
      await expect(rawInput).not.toHaveAccessibleDescription();
      await expect(canvas.queryByText(invalidJson)).not.toBeInTheDocument();
    });
  },
};
