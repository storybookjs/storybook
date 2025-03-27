import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
  ],
  framework: {
    name: '@storybook/svelte-vite',
    options: {},
  },
};
export default config;
