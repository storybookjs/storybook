import type { StorybookConfig } from '@storybook/server-webpack5';

const mainConfig: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(json|yaml|yml)'],
  logLevel: 'debug',
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-links'
  ],
  core: {
    disableTelemetry: true,
  },
  features: {},
  framework: '@storybook/server-webpack5',
};

module.exports = mainConfig;
