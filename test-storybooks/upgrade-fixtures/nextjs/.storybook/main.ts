import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [],
  framework: '@storybook/nextjs',
};

export default config;
