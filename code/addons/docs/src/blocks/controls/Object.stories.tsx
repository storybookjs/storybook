import React, { useEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { destroyAnnouncer } from '@react-aria/live-announcer';

import { expect, fireEvent, fn, waitFor } from 'storybook/test';

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

export const JsonByDefault: Story = {
  args: {
    value: {
      name: 'Michael',
      someDate: new Date('2022-10-30T12:31:11'),
      nested: { someBool: true, someNumber: 22 },
    },
    defaultEditor: 'json',
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
};

export const UndefinedArray: Story = {
  args: {
    value: undefined,
    argType: { type: { name: 'array', value: { name: 'string' } } },
  },
};

/** Setting an undefined value opens the raw editor with the caret inside the seeded brackets. */
export const SetObject: Story = {
  args: Undefined.args,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Set object' }));
    await expect(args.onChange).toHaveBeenCalledWith({});

    const rawInput = await canvas.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Edit object as JSON',
    });
    await expect(rawInput).toHaveValue('{}');
    await expect(rawInput).toHaveFocus();
    await expect([rawInput.selectionStart, rawInput.selectionEnd]).toEqual([1, 1]);
    await expect(
      canvas.getByRole('button', { name: 'Edit object with the object editor' })
    ).toBeVisible();
  },
};

/** The seeded value takes focus once: switching editors afterwards leaves focus on the button. */
export const SetObjectThenSwitchEditors: Story = {
  args: Undefined.args,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Set object' }));
    await expect(await canvas.findByRole('textbox', { name: 'Edit object as JSON' })).toHaveFocus();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit object with the object editor' })
    );
    const backToJson = canvas.getByRole('button', { name: 'Edit object as JSON' });
    await userEvent.click(backToJson);

    await expect(canvas.getByRole('textbox', { name: 'Edit object as JSON' })).not.toHaveFocus();
    await expect(
      canvas.getByRole('button', { name: 'Edit object with the object editor' })
    ).toHaveFocus();
  },
};

export const SetArray: Story = {
  args: UndefinedArray.args,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Set array' }));
    await expect(args.onChange).toHaveBeenCalledWith([]);

    await expect(await canvas.findByRole('textbox', { name: 'Edit object as JSON' })).toHaveValue(
      '[]'
    );
    await expect(
      canvas.getByRole('button', { name: 'Edit object with the array editor' })
    ).toBeVisible();
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
const lockedReason = 'Fix the invalid JSON to switch editors';

/** A parse error is raised when the raw editor is left, not while typing in it. */
export const JsonEditorValidation: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ args, canvas, step, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit object as JSON' }));
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

/**
 * Switching to the other editor drops the raw draft, so the switch is disabled for as long as the
 * draft does not parse.
 */
export const JsonEditorInvalidDraftLocksSwitch: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ args, canvas, step, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit object as JSON' }));
    const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });
    const getSwitchButton = () =>
      canvas.getByRole('button', { name: 'Edit object with the object editor' });

    await step('Clicking the switch while the draft is invalid keeps the draft', async () => {
      await userEvent.clear(rawInput);
      await userEvent.type(rawInput, '{{"label":');
      // The click itself moves focus out of the editor, which is what raises the error.
      await userEvent.click(getSwitchButton());

      await expect(getSwitchButton()).toHaveAttribute('aria-disabled', 'true');
      await expect(getSwitchButton()).toHaveAccessibleDescription(lockedReason);
      await expect(rawInput).toBeVisible();
      await expect(rawInput).toHaveValue('{"label":');
      await expect(rawInput).toHaveAttribute('aria-invalid', 'true');
    });

    await step('The switch works again once the draft is valid', async () => {
      await userEvent.type(rawInput, '"updated"}');

      await expect(getSwitchButton()).not.toHaveAttribute('aria-disabled');
      await expect(getSwitchButton()).not.toHaveAccessibleDescription();
      await userEvent.click(getSwitchButton());

      await expect(rawInput).not.toBeInTheDocument();
      await expect(canvas.getByRole('button', { name: 'Edit object as JSON' })).toBeVisible();
      await expect(await canvas.findByText('"updated"')).toBeVisible();
      // Leaving the editor and clicking the switch both commit, and the value is passed on once.
      await expect(args.onChange).toHaveBeenCalledTimes(1);
    });
  },
};

/**
 * A screen reader's virtual cursor, voice control and some touch browsers click the switch without
 * moving focus out of the raw editor, so the click itself checks the draft.
 */
export const JsonEditorSwitchWithoutLeavingEditor: Story = {
  args: {
    value: { label: 'value' },
    onChange: fn(),
  },
  play: async ({ args, canvas, step, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit object as JSON' }));
    const rawInput = canvas.getByRole('textbox', { name: 'Edit object as JSON' });
    // fireEvent dispatches the click alone, where userEvent would move focus to the button first.
    const getSwitchButton = () =>
      canvas.getByRole('button', { name: 'Edit object with the object editor' });
    const clickSwitchWithoutMovingFocus = () => fireEvent.click(getSwitchButton());

    await step('An invalid draft keeps the raw editor open and raises the error', async () => {
      await userEvent.clear(rawInput);
      await userEvent.type(rawInput, '{{"label":');
      await clickSwitchWithoutMovingFocus();

      await expect(rawInput).toHaveFocus();
      await expect(rawInput).toHaveValue('{"label":');
      await expect(rawInput).toHaveAttribute('aria-invalid', 'true');
      await expect(rawInput).toHaveAccessibleDescription(invalidJson);
      await expect(getSwitchButton()).toHaveAttribute('aria-disabled', 'true');
      await expect(getSwitchButton()).toHaveAccessibleDescription(lockedReason);
      await expect(args.onChange).not.toHaveBeenCalled();
    });

    await step('A valid draft is committed before the editors switch', async () => {
      await userEvent.type(rawInput, '"updated"}');
      await clickSwitchWithoutMovingFocus();

      await expect(args.onChange).toHaveBeenCalledTimes(1);
      await expect(args.onChange).toHaveBeenCalledWith({ label: 'updated' });
      await expect(rawInput).not.toBeInTheDocument();
      await expect(await canvas.findByText('"updated"')).toBeVisible();
    });
  },
};
