import type { StorybookConfig } from "@storybook/nextjs-vite";
import svgr from "vite-plugin-svgr";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/Image.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  features: {
    experimentalRSC: true,
  },
  staticDirs: ["../public"],
  viteFinal: (config) => {
    config?.plugins?.push(svgr());
    return config;
  },
};

export default config;
