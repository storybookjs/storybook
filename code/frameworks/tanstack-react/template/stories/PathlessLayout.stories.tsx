import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router';
import { expect, fn, within } from 'storybook/test';

// Regression coverage for pathless layout routes (`_authed`-style underscore
// files and `(group)` directories). The layout must render and its
// `beforeLoad` must run, while contributing nothing to the URL: the story
// mounts at `/dashboard`, not `/_authed/dashboard`.

function LeafContent() {
  return <p data-testid="pathless-leaf">leaf rendered under a pathless layout</p>;
}

const onBeforeLoad = fn();

const RootRoute = createRootRoute({
  component: () => (
    <div data-testid="pathless-root">
      <h1>root layout</h1>
      <Outlet />
    </div>
  ),
});

const PathlessLayout = createRoute({
  id: 'authed',
  getParentRoute: () => RootRoute,
  beforeLoad: onBeforeLoad,
  component: () => (
    <section data-testid="pathless-layout">
      <Outlet />
    </section>
  ),
});

const DashboardRoute = createRoute({
  path: '/dashboard',
  getParentRoute: () => PathlessLayout,
  component: LeafContent,
});

PathlessLayout.addChildren([DashboardRoute]);

// Regression coverage for a pathless layout nested under a pathful ancestor
// (e.g. `/products/_authed`): the layout's mount URL must be inferred from
// its pathful ancestor, not just '/'.

const onNestedBeforeLoad = fn();

function ProductsLayout() {
  return (
    <div data-testid="products-layout">
      <Outlet />
    </div>
  );
}

const ProductsRoute = createRoute({
  path: '/products',
  getParentRoute: () => RootRoute,
  component: ProductsLayout,
});

const NestedPathlessLayout = createRoute({
  id: 'nested-authed',
  getParentRoute: () => ProductsRoute,
  beforeLoad: onNestedBeforeLoad,
  component: () => (
    <section data-testid="nested-pathless-layout">
      <Outlet />
    </section>
  ),
});

const NestedSettingsRoute = createRoute({
  path: '/settings',
  getParentRoute: () => NestedPathlessLayout,
  component: LeafContent,
});

NestedPathlessLayout.addChildren([NestedSettingsRoute]);
ProductsRoute.addChildren([NestedPathlessLayout]);

// A single `addChildren` call per parent: it replaces (not appends to) the
// children array, so `RootRoute`'s two top-level branches must be registered
// together.
RootRoute.addChildren([PathlessLayout, ProductsRoute]);

const meta = {
  component: LeafContent,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LeafContent>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The leaf mounts at the layout-free URL, with every ancestor layout rendered. */
export const RendersLeafThroughPathlessLayout: Story = {
  parameters: {
    tanstack: { router: { route: DashboardRoute, path: '/dashboard' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('pathless-root')).toBeInTheDocument();
    await expect(canvas.getByTestId('pathless-layout')).toBeInTheDocument();
    await expect(canvas.getByTestId('pathless-leaf')).toBeInTheDocument();
    await expect(onBeforeLoad).toHaveBeenCalled();
  },
};

/** Binding the layout route itself (no path) mounts the story at the layout's position. */
export const BoundDirectlyToPathlessLayout: Story = {
  parameters: {
    tanstack: { router: { route: PathlessLayout } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // injectStoryComponent replaces the layout's own `component` with the
    // story's render (LeafContent), so `pathless-layout` itself is gone —
    // assert the root layout plus the leaf content that now renders in its place.
    await expect(canvas.getByTestId('pathless-root')).toBeInTheDocument();
    await expect(canvas.getByTestId('pathless-leaf')).toBeInTheDocument();
  },
};

/**
 * A pathless layout nested under a pathful ancestor (`/products`). Binding
 * the story directly to the nested layout must mount it at `/products`
 * (inferred from the ancestor's path), with the root and the `/products`
 * ancestor both rendered around the story's own content.
 */
export const BoundDirectlyToNestedPathlessLayout: Story = {
  parameters: {
    tanstack: { router: { route: NestedPathlessLayout } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('pathless-root')).toBeInTheDocument();
    await expect(canvas.getByTestId('products-layout')).toBeInTheDocument();
    // injectStoryComponent replaces the nested layout's own `component`, so
    // `nested-pathless-layout` itself is gone — assert the leaf content that
    // now renders in its place instead.
    await expect(canvas.getByTestId('pathless-leaf')).toBeInTheDocument();
    await expect(onNestedBeforeLoad).toHaveBeenCalled();
  },
};
