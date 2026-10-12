import { dirname as value } from 'node:path';

const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  framework: '@storybook/react-vite',
  viteFinal: (viteConfig) => ({ ...viteConfig, root: value(import.meta.url) }),
};
export default config;
