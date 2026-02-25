import type { Meta, StoryObj } from "@storybook/react";

import { routeTree } from "../../../../routeTree.gen";
import { expect, within } from "storybook/test";

const meta: Meta = {
  title: "TanStack/FileBasedRouting",
  render: () => null,
};

export default meta;

export const IndexRoute: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        routeTree,
        initialEntries: ["/"],
        mockLoaders: { "/": () => ({}) },
      },
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
  },
};
