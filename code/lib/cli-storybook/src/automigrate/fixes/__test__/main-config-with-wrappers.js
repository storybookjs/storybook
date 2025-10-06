import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const wrapForPnp = (packageName) =>
  dirname(fileURLToPath(import.meta.resolve(`${packageName}/package.json`)));

const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [wrapForPnp('@storybook/addon-links'), wrapForPnp('@storybook/addon-essentials')],
  framework: {
    name: wrapForPnp('@storybook/angular'),
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};
export default config;
