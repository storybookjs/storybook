import type { Meta, StoryObj } from "@storybook/react";

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { expect, within } from "storybook/test";

import { ProductModal, ProductListPage } from "./RouteMaskingExample";

const rootRoute = createRootRoute({ component: () => null });
const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products",
  component: ProductListPage,
});
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products/$productId",
  component: ProductModal,
});
const routeTree = rootRoute.addChildren([listRoute, detailRoute]);

const maskedRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/products"] }),
  routeMasks: [
    {
      from: "/products",
      to: "/products/$productId",
      params: { productId: "42" },
    },
  ],
});

const meta: Meta = {
  title: "TanStack/RouteMasking",
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        instance: maskedRouter,
      },
    },
  },
};

export default meta;

export const MaskedProductRoute: StoryObj = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole("heading", {
      name: /Product Detail/i,
    });
    expect(heading).toBeInTheDocument();
    const idText = canvas.getByText(/Product ID:/);
    expect(idText).toBeInTheDocument();
    const productId = canvas.getByText("42");
    expect(productId).toBeInTheDocument();
  },
};
