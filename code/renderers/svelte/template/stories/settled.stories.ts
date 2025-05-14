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

/*
TODO: Enable this story once async components have been released in Svelte.
https://github.com/sveltejs/svelte/discussions/15845

export const Async: StoryObj<typeof AsyncComponent> = {
  render: (args) => ({
    Component: AsyncComponent,
    props: args,
  }),
  args: {
    onEffect: fn(),
  },
  play: async ({ canvas, args }) => {
    await expect(args.onEffect).not.toHaveBeenCalled();
    await expect(canvas.getElementById('sb-pending-async-component-notice')).toBeInTheDocument();

    // TODO: Ideally we should be able to call await svelte.settled() here instead of waitFor, but currently there's a bug making it never resolve
    // await svelte.settled();

    await waitFor(() => {
      expect(args.onEffect).toHaveBeenCalledOnce();
      expect(canvas.getByTestId('after-effect')).toBeInTheDocument();
    });
  },
};
*/
