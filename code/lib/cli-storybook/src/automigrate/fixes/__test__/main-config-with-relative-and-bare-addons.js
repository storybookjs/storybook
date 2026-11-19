const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    './addons/google-analytics/register',
    {
      name: './addons/local-manager',
      options: {},
    },
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};
export default config;
