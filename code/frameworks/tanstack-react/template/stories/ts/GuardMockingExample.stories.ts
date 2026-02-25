import type { Meta, StoryObj } from "@storybook/react";

import { createRootRoute, createRoute, redirect } from "@tanstack/react-router";
import { expect, within } from "storybook/test";

import { ProtectedDashboard, LoginPage } from "./GuardMockingExample";

function createGuardedRouteTree() {
  const rootRoute = createRootRoute({ component: () => null });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: LoginPage,
  });
  const protectedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/protected",
    beforeLoad: async () => {
      throw redirect({ to: "/login" });
    },
    component: ProtectedDashboard,
  });
  return rootRoute.addChildren([loginRoute, protectedRoute]);
}

const meta: Meta = {
  title: "TanStack/GuardMocking",
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createGuardedRouteTree,
        initialEntries: ["/protected"],
      },
    },
  },
};

export default meta;

export const WithMockBeforeLoad: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createGuardedRouteTree,
        initialEntries: ["/protected"],
        mockBeforeLoad: {
          "/protected": async () => {},
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole("heading", {
      name: /Protected Dashboard/i,
    });
    expect(heading).toBeInTheDocument();
  },
};

export const WithBypassGuards: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createGuardedRouteTree,
        initialEntries: ["/protected"],
        bypassGuards: true,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole("heading", {
      name: /Protected Dashboard/i,
    });
    expect(heading).toBeInTheDocument();
  },
};
