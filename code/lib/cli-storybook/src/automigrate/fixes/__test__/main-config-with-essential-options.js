const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {
        docs: false,
        backgrounds: false,
        measure: false,
        outline: false,
        grid: false,
      },
    },
  ],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};
export default config;
