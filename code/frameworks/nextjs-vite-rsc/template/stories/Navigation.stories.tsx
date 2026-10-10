import preview from '#.storybook/preview';

import { expect, screen, waitFor } from 'storybook/test';

import { Navigation } from './Navigation';

/**
 * `next/link` and `usePathname()` in Next's own router, at the URL of `parameters.nextjs.url`. A link
 * to a route of the app opens its page, as in the app.
 */
const meta = preview.meta({
  component: Navigation,
  parameters: { nextjs: { url: '/dashboard/settings' } },
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Current path: /dashboard/settings')).toBeVisible();
  },
});

export const LinkToTheHomePage = meta.story({
  parameters: { layout: 'fullscreen' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('link', { name: 'Home' }));
    await waitFor(() => expect(window.location.pathname).toBe('/'), { timeout: 10_000 });
    await expect(await screen.findByRole('main')).toBeVisible();
  },
});
