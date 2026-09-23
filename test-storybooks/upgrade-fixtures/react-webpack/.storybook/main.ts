import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.js'],
  addons: [],
  framework: '@storybook/react-webpack5',
};

export default config;
