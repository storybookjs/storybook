import { dirname as pathDirname } from 'path';

const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  framework: '@storybook/react-vite',
  viteFinal: (viteConfig) => ({ ...viteConfig, root: pathDirname(import.meta.url) }),
};
export default config;
