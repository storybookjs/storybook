import path from 'node:path';

const wrapForPnp = (packageName) =>
  path.dirname(require.resolve(path.join(packageName, 'package.json')));

const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    wrapForPnp('@storybook/addon-links'),
    wrapForPnp('@storybook/addon-essentials'),
    wrapForPnp('@storybook/addon-interactions'),
  ],
  framework: {
    name: wrapForPnp('@storybook/angular'),
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};
export default config;
