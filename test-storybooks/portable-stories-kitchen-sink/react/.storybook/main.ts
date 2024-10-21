import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/experimental-addon-test",
    "@storybook/addon-controls"
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableWhatsNewNotifications: true
  },
};
export default config;
