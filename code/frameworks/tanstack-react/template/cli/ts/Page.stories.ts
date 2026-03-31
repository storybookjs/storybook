import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { expect, userEvent, within } from 'storybook/test';

import { Page } from './Page';

const meta = {
  title: 'Example/Page',
  component: Page,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {};

// More on component testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const LoggedIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    await expect(loginButton).not.toBeInTheDocument();

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  },
};

// Use the tanstack.router.path parameter to set the initial route for a story
export const WithRouterPath: Story = {
  parameters: {
    tanstack: {
      router: {
        path: '/settings?tab=profile',
      },
    },
  },
};

/** Clicking a TanStack Router <Link> logs the navigation in the Actions panel. */
export const NavigateToAbout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const aboutLink = canvas.getByRole('link', { name: /About/i });
    await expect(aboutLink).toBeInTheDocument();
    await userEvent.click(aboutLink);
  },
};
