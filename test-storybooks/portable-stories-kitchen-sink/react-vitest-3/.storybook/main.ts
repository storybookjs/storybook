import { join } from "node:path";

import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-vitest", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableWhatsNewNotifications: true,
  },
  previewHead: (head = "") => `${head}
  <style>
    body {
      border: 1px solid red;
    }
  </style>`,
  staticDirs: [{ from: "./test-static-dirs", to: "test-static-dirs" }],
  viteFinal: (config) => {
    return {
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        include: [...(config.optimizeDeps?.include || [])],
      },
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          "test-alias": join(import.meta.dirname, "aliased.ts"),
        },
      },
    };
  },
  refs: {
    "storybook@8.0.0": {
      title: "Storybook 8.0.0",
      url: "https://635781f3500dd2c49e189caf-gckybvsekn.chromatic.com/",
    },
    "storybook@7.6.18": {
      title: "Storybook 7.6.18",
      url: "https://635781f3500dd2c49e189caf-oljwjdrftz.chromatic.com/",
    },
  },
};

export default config;
