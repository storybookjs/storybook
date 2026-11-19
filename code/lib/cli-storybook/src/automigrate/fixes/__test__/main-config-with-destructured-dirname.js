import path from 'node:path';

const { dirname } = path;

const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  framework: '@storybook/react-vite',
  viteFinal: (viteConfig) => ({ ...viteConfig, root: dirname(import.meta.url) }),
};
export default config;
