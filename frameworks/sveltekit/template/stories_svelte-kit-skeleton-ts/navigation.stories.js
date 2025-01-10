import { expect, fn, within } from '@storybook/test';

import Navigation from './Navigation.svelte';

export default {
  title: 'stories/sveltekit/modules/navigation',
  component: Navigation,
  tags: ['autodocs'],
};

const goto = fn();

export const Goto = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByText('goto');
    button.click();
    expect(goto).toHaveBeenCalledWith('/storybook-goto');
  },
  parameters: {
    sveltekit_experimental: {
      navigation: {
        goto,
      },
    },
  },
};

const replaceState = fn();

export const ReplaceState = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByText('replaceState');
    button.click();
    expect(replaceState).toHaveBeenCalledWith('/storybook-replace-state', {});
  },
  parameters: {
    sveltekit_experimental: {
      navigation: {
        replaceState,
      },
    },
  },
};

const pushState = fn();

export const PushState = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByText('pushState');
    button.click();
    expect(pushState).toHaveBeenCalledWith('/storybook-push-state', {});
  },
  parameters: {
    sveltekit_experimental: {
      navigation: {
        pushState,
      },
    },
  },
};

export const DefaultActions = {};

const invalidate = fn();

export const Invalidate = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByText('invalidate', { exact: true });
    button.click();
    expect(invalidate).toHaveBeenCalledWith('/storybook-invalidate');
  },
  parameters: {
    sveltekit_experimental: {
      navigation: {
        invalidate,
      },
    },
  },
};

const invalidateAll = fn();

export const InvalidateAll = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const button = canvas.getByText('invalidateAll');
    button.click();
    expect(invalidateAll).toHaveBeenCalledWith();
  },
  parameters: {
    sveltekit_experimental: {
      navigation: {
        invalidateAll,
      },
    },
  },
};

const afterNavigateFn = fn();

export const AfterNavigate = {
  async play() {
    expect(afterNavigateFn).toHaveBeenCalledWith({ test: 'passed' });
  },
  args: {
    afterNavigateFn,
  },
  parameters: {
    sveltekit_experimental: {
      navigation: {
        afterNavigate: {
          test: 'passed',
        },
      },
    },
  },
};
