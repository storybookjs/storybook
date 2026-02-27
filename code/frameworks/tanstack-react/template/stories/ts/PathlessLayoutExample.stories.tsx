import type { Meta, StoryObj } from '@storybook/react';

import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

import { AppLayout, DashboardPage, SettingsPage } from './PathlessLayoutExample';

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
  component: AppLayout,
});
const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/dashboard',
  component: DashboardPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings',
  component: SettingsPage,
});
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([dashboardRoute, settingsRoute]),
]);

const meta: Meta = {
  title: 'TanStack/PathlessLayout',
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        routeTree,
        initialEntries: ['/dashboard'],
      },
    },
  },
};

export default meta;

export const Dashboard: StoryObj = {
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
    const heading = await canvas.findByRole('heading', { name: /Dashboard/i });
    expect(heading).toBeInTheDocument();
    const welcomeText = canvas.getByText(/Welcome to your dashboard/);
    expect(welcomeText).toBeInTheDocument();
    const dashboardLink = canvas.getByRole('link', { name: /Dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
  },
};

export const Settings: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        routeTree,
        initialEntries: ['/settings'],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', { name: /Settings/i });
    expect(heading).toBeInTheDocument();
    const settingsText = canvas.getByText(/Manage your settings/);
    expect(settingsText).toBeInTheDocument();
    const dashboardLink = canvas.getByRole('link', { name: /Dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
  },
};

