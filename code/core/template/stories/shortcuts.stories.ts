import type { PlayFunctionContext } from '@storybook/csf';
import { global as globalThis } from '@storybook/global';
import { expect, fn, userEvent, within } from '@storybook/test';

import { PREVIEW_KEYDOWN } from '@storybook/core/core-events';

export default {
  component: globalThis.Components.Form,
  tags: ['autodocs'],
  args: {
    onSubmit: fn(),
    onSuccess: fn(),
  },
};

export const KeydownDuringPlay = {
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;

    const previewKeydown = fn();
    channel.on(PREVIEW_KEYDOWN, previewKeydown);
    const button = await within(canvasElement).findByText('Submit');
    await userEvent.type(button, 's');

    await expect(previewKeydown).not.toBeCalled();
  },
};
