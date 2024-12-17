import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-controls",
    "@storybook/experimental-addon-test",
    //"@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableWhatsNewNotifications: true,
  },
  viteFinal: (config) => ({
    ...config,
    optimizeDeps: {
      ...config.optimizeDeps,
      include: [
        ...(config.optimizeDeps?.include || []),
        "react-dom/test-utils",
        "@storybook/react/**",
        "@storybook/experimental-addon-test/preview",
      ],
    },
  }),
  previewHead: (head = "") => `${head}
  <style>
    body {
      border: 1px solid red;
    }
  </style>`,
};
export default config;
