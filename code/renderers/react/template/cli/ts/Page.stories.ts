import preview from '../../.storybook/preview';

import { expect, userEvent, within } from 'storybook/test';

import { Page } from './Page';

const meta = preview.meta({
  title: 'Example/Page',
  component: Page,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
});

export const LoggedOut = meta.story();

// More on component testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const LoggedIn = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    await expect(loginButton).not.toBeInTheDocument();

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  },
});
