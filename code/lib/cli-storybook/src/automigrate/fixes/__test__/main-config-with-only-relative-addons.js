const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['./addons/google-analytics/register'],
  framework: {
    name: './frameworks/custom-framework',
    options: {},
  },
};
export default config;
