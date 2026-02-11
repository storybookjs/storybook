import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import UnstableRethrow from "./UnstableRethrow";

export default {
  component: UnstableRethrow,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof UnstableRethrow>;

type Story = StoryObj<typeof UnstableRethrow>;

export const Default: Story = {};

export const WithCatch: Story = {
  args: {
    shouldCatch: true,
  },
};
