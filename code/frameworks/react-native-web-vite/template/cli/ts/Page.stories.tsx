import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { expect, userEvent, within } from 'storybook/test';

import { Page } from './Page';

const meta = {
  title: 'Example/Page',
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  },
};

export const LoggedOut: Story = {};
