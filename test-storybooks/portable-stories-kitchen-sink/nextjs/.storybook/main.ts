import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
};
export default config;
