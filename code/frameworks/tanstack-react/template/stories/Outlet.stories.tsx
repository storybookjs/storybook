import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

// Regression coverage for https://github.com/storybookjs/storybook/issues/35007
// `@tanstack/react-router`'s `Outlet` used to be mocked as `() => null`, which
// silently swallowed any leaf content rendered inside a root layout. These
// stories assert that both the root layout and the leaf content render.

function LeafContent() {
  return <p data-testid="tanstack-outlet-leaf">leaf rendered inside root outlet</p>;
}

const RootRoute = createRootRoute({
  component: () => (
    <div data-testid="tanstack-outlet-root">
      <h1>root layout</h1>
      <Outlet />
    </div>
  ),
});

const LeafRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: LeafContent,
});

RootRoute.addChildren([LeafRoute]);

const meta = {
  component: LeafContent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LeafContent>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Passing the leaf `Route` should render it inside the root layout's `<Outlet />`. */
export const RendersLeafInsideRootOutlet: Story = {
  parameters: {
    tanstack: { router: { route: LeafRoute } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('tanstack-outlet-root')).toBeInTheDocument();
    await expect(canvas.getByTestId('tanstack-outlet-leaf')).toBeInTheDocument();
  },
};

/** Passing the whole route tree plus an explicit `path` resolves through the same outlet. */
export const RendersLeafViaRouteTreePath: Story = {
  parameters: {
    tanstack: {
      router: { route: RootRoute, path: '/' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('tanstack-outlet-root')).toBeInTheDocument();
    await expect(canvas.getByTestId('tanstack-outlet-leaf')).toBeInTheDocument();
  },
};
