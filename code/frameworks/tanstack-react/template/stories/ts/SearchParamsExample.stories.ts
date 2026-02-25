import type { Meta, StoryObj } from "@storybook/react";

import { z } from "zod";
import { createRootRoute, createRoute } from "@tanstack/react-router";
import { createStorySearchParams } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";

import { SearchParamsDisplay } from "./SearchParamsExample";

const searchSchema = z.object({
  page: z.number().default(1),
  query: z.string().default(""),
});

// Module-scope route for type inference
const _rootRoute = createRootRoute({ component: () => null });
const _searchRoute = createRoute({
  getParentRoute: () => _rootRoute,
  path: "/search",
  validateSearch: searchSchema,
  component: SearchParamsDisplay,
});

function createSearchRouteTree() {
  const rootRoute = createRootRoute({ component: () => null });
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/search",
    validateSearch: searchSchema,
    component: SearchParamsDisplay,
  });
  return rootRoute.addChildren([searchRoute]);
}

const defaultSearch = createStorySearchParams<typeof _searchRoute>({
  page: 3,
  query: "storybook",
});

const meta: Meta = {
  title: "TanStack/SearchParams",
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createSearchRouteTree,
        initialEntries: ["/search"],
        defaultSearch,
      },
    },
  },
};

export default meta;

export const WithSearchParams: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pageText = await canvas.findByText(/Page: 3/);
    expect(pageText).toBeInTheDocument();
    const queryText = await canvas.findByText(/Query: storybook/);
    expect(queryText).toBeInTheDocument();
  },
};
