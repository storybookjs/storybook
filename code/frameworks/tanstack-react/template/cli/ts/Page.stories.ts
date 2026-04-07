import { type Meta, type StoryObj } from '@storybook/tanstack-react';
import { expect, userEvent, within } from 'storybook/test';
import { Route, type PageLoaderData } from './Page';

const sampleLoaderData: PageLoaderData = {
  featuredItems: [
    { id: 1, title: 'Type-safe routing', description: 'Full path & search param inference' },
    { id: 2, title: 'Route loaders', description: 'Data fetching before render' },
    { id: 3, title: 'Search validation', description: 'Zod-powered search params' },
  ],
};

const meta = {
  title: 'Example/Page',
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
  component: Route,
} satisfies Meta<typeof Route>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {
  parameters: {
    tanstack: {
      router: {
        route: {
          loader: async () => ({
            featuredItems: sampleLoaderData.featuredItems,
          }),
        },
      },
    },
  },
};

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

/** Clicking a TanStack Router <Link> logs the navigation in the Actions panel. */
export const NavigateToAbout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const aboutLink = canvas.getByRole('link', { name: /About/i });
    await expect(aboutLink).toBeInTheDocument();
    await userEvent.click(aboutLink);
  },
};
