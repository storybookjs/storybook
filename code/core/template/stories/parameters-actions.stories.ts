import type { PlayFunctionContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { fn, userEvent, within } from 'storybook/test';

import { withActions } from 'storybook/actions/decorator';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const Basic = {
  parameters: {
    actions: {
      handles: [{ click: 'clicked', contextmenu: 'right clicked' }],
    },
  },
  decorators: [withActions],
};

export const LimitRetainsNewest = {
  args: {
    onClick: fn(),
  },
  parameters: {
    actions: {
      limit: 3,
    },
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole('button');

    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);
  },
};
