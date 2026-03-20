import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

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

export const JsonEditorValidation: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Open the raw JSON editor and verify it is described', async () => {
      const editAsJsonButton = canvas.getByRole('switch', { name: 'Edit object as JSON' });

      await expect(editAsJsonButton).toHaveAttribute('aria-describedby');
      await fireEvent.click(editAsJsonButton);
      await expect(
        canvas.getByRole('textbox', { name: 'Edit object as JSON' })
      ).toBeInTheDocument();
    });

    await step('Show a parse error for invalid JSON', async () => {
      const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });

      rawInput.focus();
      await fireEvent.change(rawInput, { target: { value: '{"label":' } });
      rawInput.blur();

      const parseError = await canvas.findByRole('status');
      await expect(parseError).toHaveTextContent('Invalid JSON');
      await expect(rawInput).toHaveAttribute('aria-invalid', 'true');
      await expect(rawInput).toHaveAttribute(
        'aria-describedby',
        parseError.getAttribute('id') ?? ''
      );
      await expect(args.onChange).not.toHaveBeenCalled();
    });

    await step('Clear the parse error after entering valid JSON', async () => {
      const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });

      rawInput.focus();
      await fireEvent.change(rawInput, { target: { value: '{"label":"updated"}' } });
      rawInput.blur();

      await waitFor(async () => {
        await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
      });
      await expect(rawInput).toHaveAttribute('aria-invalid', 'false');
      await expect(rawInput).not.toHaveAttribute('aria-describedby');
      await expect(args.onChange).toHaveBeenCalledWith({ label: 'updated' });
    });
  },
};

export const JsonEditorErrorReset: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Create a parse error in the raw JSON editor', async () => {
      const editAsJsonButton = canvas.getByRole('switch', { name: 'Edit object as JSON' });
      await fireEvent.click(editAsJsonButton);

      const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });
      rawInput.focus();
      await fireEvent.change(rawInput, { target: { value: '{"label":' } });
      rawInput.blur();

      await expect(await canvas.findByRole('status')).toHaveTextContent('Invalid JSON');
      await expect(rawInput).toHaveAttribute('aria-invalid', 'true');
    });

    await step('Clear stale parse errors after closing and reopening the editor', async () => {
      const editAsJsonButton = canvas.getByRole('switch', { name: 'Edit object as JSON' });
      await fireEvent.click(editAsJsonButton);
      await fireEvent.click(canvas.getByRole('switch', { name: 'Edit object as JSON' }));

      const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });
      await waitFor(async () => {
        await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
      });
      await expect(rawInput).toHaveAttribute('aria-invalid', 'false');
      await expect(rawInput).not.toHaveAttribute('aria-describedby');
    });
  },
};
