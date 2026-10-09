import preview from '#.storybook/preview';

import { expect } from 'storybook/test';

/**
 * A story without a component and without a `render` function is a page of the app: the route at
 * `parameters.nextjs.url`, in its layouts, as a browser opens it.
 */
const meta = preview.meta({
  parameters: { layout: 'fullscreen' },
});

export const Home = meta.story({
  parameters: { nextjs: { url: '/' } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('main')).toBeVisible();
  },
});

export const NotFound = meta.story({
  parameters: { nextjs: { url: '/this-route-does-not-exist' } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('This page could not be found.')).toBeVisible();
  },
});
