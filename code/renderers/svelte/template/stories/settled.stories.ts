import type { StoryObj } from '@storybook/svelte';

import { expect, fn, waitFor } from 'storybook/test';

import AsyncComponent from './AsyncComponent.svelte';
import SyncComponent from './SyncComponent.svelte';

export default {
  title: 'stories/renderers/svelte/settled',
};

export const Sync: StoryObj<typeof SyncComponent> = {
  render: (args) => ({
    Component: SyncComponent,
    props: args,
  }),
  args: {
    onEffect: fn(),
  },
  play: async ({ canvas, args }) => {
    await expect(args.onEffect).toHaveBeenCalledOnce();
    await expect(canvas.getByTestId('after-effect')).toBeInTheDocument();
  },
};

export const Async: StoryObj<typeof AsyncComponent> = {
  render: (args) => ({
    Component: AsyncComponent,
    props: args,
  }),
  args: {
    onEffect: fn(),
  },
  play: async ({ canvas, canvasElement, args }) => {
    await expect(args.onEffect).not.toHaveBeenCalled();
    await expect(
      canvasElement.querySelector('#sb-pending-async-component-notice')
    ).toBeInTheDocument();

    // TODO: Ideally we should be able to call await svelte.settled() here instead of waitFor, but currently there's a bug making it never resolve
    // await svelte.settled();

    await waitFor(async () => {
      await expect(args.onEffect).toHaveBeenCalledOnce();
      await expect(canvas.getByTestId('after-effect')).toBeInTheDocument();
      await expect(
        canvasElement.querySelector('#sb-pending-async-component-notice')
      ).not.toBeInTheDocument();
    });
  },
};
