/// <reference types="node" />
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: [
    '../../core/src/manager/**/*.stories.@(ts|tsx|js|jsx|mdx)',
    '../../core/src/components/**/*.stories.@(ts|tsx|js|jsx|mdx)',
    './../../addons/docs/**/*.stories.@(ts|tsx|js|jsx|mdx)',
    './../../addons/interactions/**/*.stories.@(ts|tsx|js|jsx|mdx)',
  ],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        sourceLoaderOptions: null,
      },
    },
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
  ],
  core: {
    channelOptions: { maxDepth: 10 },
    disableTelemetry: true,
  },
  logLevel: 'debug',
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      strictMode: true,
    },
  },
};
module.exports = config;
