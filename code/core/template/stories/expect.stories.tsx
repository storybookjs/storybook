import type { Meta, StoryObj } from '@storybook/react';

import { expect } from 'storybook/test';

const meta = {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExpectInstrumentation: Story = {
  args: {
    label: 'Test Button',
  },
  play: async () => {
    // Make sure our instrumentation doesn't stand in the way of common expect use cases.
    class CustomError extends Error {}

    await expect(() => {
      throw new CustomError();
    }).toThrow(CustomError);

    // https://github.com/storybookjs/storybook/issues/29816
    await expect('hi').toEqual(expect.any(String));
  },
};
