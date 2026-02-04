import type { Meta, StoryObj } from "@storybook/react";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
} from "@tanstack/react-router";
import { createStoryMemoryRouter } from "@storybook/tanstack-react";
import { expect, within, userEvent } from "storybook/test";

import {
  RouterAbout,
  RouterAppLayout,
  RouterAppSettings,
  RouterHome,
  RouterLayout,
  RouterPost,
} from "./RouterExample";

const rootRoute = createRootRoute({
  component: RouterLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: RouterHome,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "about",
  component: RouterAbout,
});

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "posts/$postId",
  component: RouterPost,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "app",
  component: RouterAppLayout,
});

const appSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "settings",
  component: RouterAppSettings,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  postRoute,
  appRoute.addChildren([appSettingsRoute]),
]);

const meta: Meta<typeof RouterProvider> = {
  // The router is provided via parameters, so the story render itself can be empty.
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        instance: createStoryMemoryRouter({
          routeTree,
          initialEntries: ["/posts/42"],
        }),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof RouterProvider>;

export const InitialRouteHome: Story = {
  parameters: {
    tanstack: {
      router: createStoryMemoryRouter({
        routeTree,
        initialEntries: ["/"],
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText("This route is the home route."),
    ).toBeInTheDocument();
    // navigate to post 42
    await userEvent.click(canvas.getByText("Post 42"));
    expect(canvas.getByText("Post ID from params: 42")).toBeInTheDocument();
    // navigate to app settings
    await userEvent.click(canvas.getByText("App settings"));
    expect(
      canvas.getByText("Nested settings route rendered under the app layout."),
    ).toBeInTheDocument();
  },
};

export const InitialRoutePosts42: Story = {
  parameters: {
    tanstack: {
      router: createStoryMemoryRouter({
        routeTree,
        initialEntries: ["/posts/42"],
      }),
    },
  },
};

export const InitialRouteAbout: Story = {
  parameters: {
    tanstack: {
      router: createStoryMemoryRouter({
        routeTree,
        initialEntries: ["/about"],
      }),
    },
  },
};
