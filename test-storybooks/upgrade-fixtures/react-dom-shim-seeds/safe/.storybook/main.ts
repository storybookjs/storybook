import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/react-dom-shim/preset'],
  framework: '@storybook/react-vite',
};

export default config;
