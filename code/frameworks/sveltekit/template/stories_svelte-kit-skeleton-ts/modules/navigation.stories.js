import {
  goto,
  invalidate,
  invalidateAll,
  pushState,
  refreshAll,
  replaceState,
} from '$app/navigation';
import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';
import { expect, fn, userEvent } from 'storybook/test';

import Navigation from './Navigation.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/navigation',
  component: Navigation,
  args: {
    afterNavigateFn: fn(),
  },
};

export const Goto = {
  async play({ canvas }) {
    await userEvent.click(canvas.getByRole('button', { name: 'goto' }));
    await expect(goto).toHaveBeenCalledWith('/storybook-goto');
  },
};

export const ReplaceState = {
  async play({ canvas }) {
    await userEvent.click(canvas.getByRole('button', { name: 'replaceState' }));
    await expect(replaceState).toHaveBeenCalledWith('/storybook-replace-state', {});
  },
};

export const PushState = {
  async play({ canvas }) {
    await userEvent.click(canvas.getByRole('button', { name: 'pushState' }));
    await expect(pushState).toHaveBeenCalledWith('/storybook-push-state', {});
  },
};

export const Invalidate = {
  async play({ canvas }) {
    await userEvent.click(canvas.getByRole('button', { name: 'invalidate', exact: true }));
    await expect(invalidate).toHaveBeenCalledWith('/storybook-invalidate');
  },
};

export const InvalidateAll = {
  async play({ canvas }) {
    await userEvent.click(canvas.getByRole('button', { name: 'invalidateAll' }));
    await expect(invalidateAll).toHaveBeenCalledWith();
  },
};

export const RefreshAll = {
  async play({ canvas }) {
    await userEvent.click(canvas.getByRole('button', { name: 'refreshAll' }));
    await expect(refreshAll).toHaveBeenCalledWith();
  },
};

export const AfterNavigate = {
  beforeEach() {
    setAfterNavigate({ type: 'link', from: { url: new URL('https://storybook.js.org/search') } });
  },
  async play({ args }) {
    await expect(args.afterNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'link',
        from: { url: new URL('https://storybook.js.org/search') },
        to: null,
        willUnload: false,
      })
    );
  },
};

export const AfterNavigateDefault = {
  async play({ args }) {
    await expect(args.afterNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'enter',
        from: null,
        to: null,
        shallow: false,
        willUnload: false,
      })
    );
  },
};
