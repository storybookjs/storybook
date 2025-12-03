/**
 * @vitest-environment jsdom
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cacheLife, cacheTag } from "@storybook/nextjs-vite/cache.mock";
import { expect } from "storybook/test";
import CacheComponent from "./Cache";

export default {
  component: CacheComponent,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof CacheComponent>;

type Story = StoryObj<typeof CacheComponent>;

export const Default: Story = {
  args: {
    profile: "default",
    tags: ["my-tag"],
  },
  play: async () => {
    await expect(cacheLife).toHaveBeenCalledWith("default");
    await expect(cacheTag).toHaveBeenCalledWith("my-tag");
  },
};

export const WithDaysProfile: Story = {
  args: {
    profile: "days",
    tags: ["posts", "user-posts"],
  },
  play: async () => {
    await expect(cacheLife).toHaveBeenCalledWith("days");
    await expect(cacheTag).toHaveBeenCalledWith("posts");
    await expect(cacheTag).toHaveBeenCalledWith("user-posts");
  },
};

export const WithWeeksProfile: Story = {
  args: {
    profile: "weeks",
    tags: ["static-content"],
  },
  play: async () => {
    await expect(cacheLife).toHaveBeenCalledWith("weeks");
    await expect(cacheTag).toHaveBeenCalledWith("static-content");
  },
};
