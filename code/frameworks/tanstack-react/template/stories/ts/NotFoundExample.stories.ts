import type { Meta, StoryObj } from "@storybook/react";

import { createRootRoute, createRoute } from "@tanstack/react-router";
import { expect, within } from "storybook/test";

import { CustomNotFound } from "./NotFoundExample";

function createNotFoundRouteTree() {
  const rootRoute = createRootRoute({ component: () => null });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/home",
    component: () => null,
  });
  return rootRoute.addChildren([homeRoute]);
}

const meta: Meta = {
  title: "TanStack/NotFound",
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createNotFoundRouteTree,
        forceNotFound: true,
        defaultNotFoundComponent: CustomNotFound,
      },
    },
  },
};

export default meta;

export const NotFound: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = await canvas.findByRole("status");
    expect(status).toBeInTheDocument();
    const notFoundText = canvas.getByText(/404/);
    expect(notFoundText).toBeInTheDocument();
  },
};
