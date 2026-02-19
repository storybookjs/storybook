import type { Meta, StoryObj } from '@storybook/react';

import { RouterProvider, createRootRoute, createRoute } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

import { DashboardLayout, DashboardPage, ProfilePage } from './PathlessLayoutExample';

const rootRoute = createRootRoute({
  component: DashboardLayout,
});

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
  component: DashboardLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const profileRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/profile',
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([layoutRoute.addChildren([dashboardRoute, profileRoute])]);

const meta: Meta<typeof RouterProvider> = {
  title: 'Router Examples/Pathless Layouts',
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree' as const,
        routeTree,
        initialEntries: ['/dashboard'],
      },
    },
  },
};

export default meta;

export const Dashboard: StoryObj<typeof RouterProvider> = {
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        routeTree,
        initialEntries: ['/dashboard'],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
    expect(canvas.getByText(/Welcome to the dashboard/)).toBeInTheDocument();
    expect(canvas.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(canvas.getByRole('link', { name: /Profile/i })).toBeInTheDocument();
  },
};

export const Profile: StoryObj<typeof RouterProvider> = {
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        routeTree,
        initialEntries: ['/profile'],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { name: /Profile/i })).toBeInTheDocument();
    expect(canvas.getByText(/Manage your profile settings/)).toBeInTheDocument();
    expect(canvas.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  },
};
