import type { Meta, StoryObj } from '@storybook/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { RouterAbout, RouterHome, RouterLayout } from './RouterExample';

const rootRoute = createRootRoute({
  component: RouterLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RouterHome,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'about',
  component: RouterAbout,
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

const meta: Meta<typeof RouterProvider> = {
  // The router is provided via parameters, so the story render itself can be empty.
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        instance: router,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof RouterProvider>;

export const WithMemoryRouter: Story = {};
