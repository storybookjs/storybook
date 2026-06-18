import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

function DocumentRoot() {
  return (
    <html lang="en" data-testid="tanstack-start-document-root">
      <head>
        <title>TanStack Start document root</title>
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}

function AppLayout() {
  return (
    <main data-testid="tanstack-start-app-layout">
      <h1>Start route layout</h1>
      <Outlet />
    </main>
  );
}

function LeafContent() {
  return <p data-testid="tanstack-start-leaf">leaf rendered without the document root</p>;
}

const RootRoute = createRootRoute({
  component: DocumentRoot,
});

const AppRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: AppLayout,
});

const LeafRoute = createRoute({
  getParentRoute: () => AppRoute,
  path: 'dashboard',
  component: LeafContent,
});

RootRoute.addChildren([AppRoute.addChildren([LeafRoute])]);

const meta = {
  component: LeafContent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LeafContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SkipsTanStackStartDocumentRoot: Story = {
  parameters: {
    tanstack: {
      router: {
        route: LeafRoute,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Start route layout' })
    ).toBeVisible();
    await expect(canvas.getByTestId('tanstack-start-leaf')).toBeVisible();
    await expect(canvas.queryByTestId('tanstack-start-document-root')).not.toBeInTheDocument();
  },
};
