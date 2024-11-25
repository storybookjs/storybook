import type { Meta } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

import { Page } from './Page';

export default {
  title: 'Example/Page',
  component: Page,
} as Meta<typeof Page>;

export const LoggedIn = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    // FIXME: await expect(loginButton).not.toBeInTheDocument();

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  },
};

export const LoggedOut = {};
