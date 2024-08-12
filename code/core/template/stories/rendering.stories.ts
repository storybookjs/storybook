import type { PlayFunctionContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, waitFor, within } from '@storybook/test';

import {
  FORCE_REMOUNT,
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_STORY_ARGS,
} from '@storybook/core/core-events';

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click me',
  },
  tags: ['!vitest'],
};

export const ForceRemount = {
  /**
   * This play function runs in an infinite loop, because the final FORCE_REMOUNT event retriggers the function
   * Because of this, it is disabled in both Chromatic and the test runner.
   * To test it manually, inspect that the button alternates being focused and blurred every 3 seconds.
   * If the button ALWAYS has focus it means the renderer didn't correctly remount the tree at the FORCE_REMOUNT event
   */
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement, id }: PlayFunctionContext<any>) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const button = await within(canvasElement).findByRole('button');

    await waitFor(() => expect(button).not.toHaveFocus());
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await button.focus();
    await expect(button).toHaveFocus();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // By forcing the component to remount, we reset the focus state
    await channel.emit(FORCE_REMOUNT, { storyId: id });
  },
  tags: ['!test'],
};

export const ChangeArgs = {
  play: async ({ canvasElement, id }: PlayFunctionContext<any>) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });

    const button = await within(canvasElement).findByRole('button');
    await button.focus();
    await expect(button).toHaveFocus();

    // Web-components: https://github.com/storybookjs/storybook/issues/19415
    // Preact: https://github.com/storybookjs/storybook/issues/19504

    if (['web-components', 'html', 'preact'].includes(globalThis.storybookRenderer)) return;

    // When we change the args to the button, it should not remount
    await channel.emit(UPDATE_STORY_ARGS, { storyId: id, updatedArgs: { label: 'New Text' } });

    await within(canvasElement).findByText(/New Text/);
    await expect(button).toHaveFocus();
  },
};

let loadedLabel = 'Initial';

/**
 * This story demonstrates what happens when rendering (loaders) have side effects, and can possibly interleave with each other
 * Triggering multiple force remounts quickly should only result in a single remount in the end
 * and the label should be 'Loaded. Click Me' at the end. If loaders are interleaving it would result in a label of 'Error: Interleaved loaders. Click Me'
 * Similarly, changing args rapidly should only cause one rerender at a time, producing the same result.
 */
export const SlowLoader = {
  parameters: {
    chromatic: { disable: true },
  },
  loaders: [
    async () => {
      loadedLabel = 'Loading...';
      await new Promise((resolve) => setTimeout(resolve, 1000));
      loadedLabel = loadedLabel === 'Loading...' ? 'Loaded.' : 'Error: Interleaved loaders.';
      return { label: loadedLabel };
    },
  ],
  decorators: [
    (storyFn: any, context: any) =>
      storyFn({
        args: {
          ...context.args,
          label: `${context.loaded.label} ${context.args.label}`,
        },
      }),
  ],
};
