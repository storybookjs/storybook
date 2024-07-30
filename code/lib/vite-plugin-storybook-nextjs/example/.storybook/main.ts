import path from "node:path";
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-onboarding",
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  core: {
    builder: "@storybook/builder-vite",
  },
  features: {
    experimentalRSC: true,
  },
  staticDirs: ["../public"],
  viteFinal: async (config) => {
    const vitePluginNext = (await import("vite-plugin-storybook-nextjs"))
      .default;
    config.plugins.push(vitePluginNext({ dir: path.join(__dirname, "..") }));
    return config;
  },
};

export default config;
