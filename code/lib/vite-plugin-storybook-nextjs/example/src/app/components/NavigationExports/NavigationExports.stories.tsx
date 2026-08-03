import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import NavigationExports from "./NavigationExports";

export default {
  component: NavigationExports,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof NavigationExports>;

type Story = StoryObj<typeof NavigationExports>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Smoke coverage only, not a regression test: reproducing #34688 needs the mock to go
    // through Vite's pre-bundling, which does not happen while the plugin is workspace-
    // linked here. That path was verified against a real install of a packed tarball.
    await expect(
      canvas.getByTestId("server-inserted-html-context"),
    ).toHaveTextContent("resolved");
    await expect(
      canvas.getByTestId("readonly-url-search-params"),
    ).toHaveTextContent("storybook");
    await expect(canvas.getByTestId("redirect-type")).toHaveTextContent("push");
  },
};
