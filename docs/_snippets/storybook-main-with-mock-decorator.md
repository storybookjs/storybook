```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Your Storybook configuration

  webpackFinal: async (config) => {
    config.resolve.alias['isomorphic-fetch'] = require.resolve('../__mocks__/isomorphic-fetch.js');
    return config;
  },
};
```
