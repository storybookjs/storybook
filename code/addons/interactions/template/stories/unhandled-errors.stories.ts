import { userEvent, within } from 'storybook/internal/test';

import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Button',
    // onClick: fn(), <-- this is intentionally missing to trigger an unhandled error
  },
  argTypes: {
    onClick: { type: 'function' },
  },
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    chromatic: { disable: true },
  },
  tags: ['!test', '!vitest'],
};

export const Default = {
  play: async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
  },
};
