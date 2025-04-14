```js filename=".storybook/main.js|ts" renderer="common" language="js"
export default {
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  core: {
    builder: '@storybook/builder-vite',
  },
  typescript: {
    // Enables the `react-docgen-typescript` parser.
    // See https://storybook.js.org/docs/api/main-config/main-config-typescript for more information about this option.
    reactDocgen: 'react-docgen-typescript',
  },
};
```
