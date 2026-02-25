import type { Meta, StoryObj } from "@storybook/react";

import { createRootRoute, createRoute } from "@tanstack/react-router";
import { getRouter } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";

import { NavLayout, HomePage, AboutPage } from "./GetRouterExample";

function createNavRouteTree() {
  const rootRoute = createRootRoute({ component: NavLayout });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HomePage,
  });
  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/about",
    component: AboutPage,
  });
  return rootRoute.addChildren([homeRoute, aboutRoute]);
}

const meta: Meta = {
  title: "TanStack/GetRouter",
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createNavRouteTree,
        initialEntries: ["/"],
      },
    },
  },
};

export default meta;

export const ProgrammaticNavigation: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Step 1: Verify home page is rendered
    const homeHeading = await canvas.findByRole("heading", {
      name: /Home Page/i,
    });
    expect(homeHeading).toBeInTheDocument();

    // Step 2: Programmatically navigate to /about
    const router = getRouter();
    await router!.navigate({ to: "/about" });

    // Step 3: Verify about page is rendered after navigation
    const aboutHeading = await canvas.findByRole("heading", {
      name: /About Page/i,
    });
    expect(aboutHeading).toBeInTheDocument();
  },
};
