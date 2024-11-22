```js filename=".storybook/main.js" renderer="web-components" language="js"
export default {
  webpackFinal: async (config) => {
    // Find web-components rule for extra transpilation
    const webComponentsRule = config.module.rules.find(
      (rule) => rule.use && rule.use.options && rule.use.options.babelrc === false
    );
    // Add your own `my-library`
    webComponentsRule.test.push(new RegExp(`node_modules(\\/|\\\\)my-library(.*)\\.js$`));

    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts"
import type { StorybookConfig } from '@storybook/web-components-webpack5';

const config: StorybookConfig = {
  webpackFinal: async (config) => {
    // Find web-components rule for extra transpilation
    const webComponentsRule = config.module.rules.find(
      (rule) => rule.use && rule.use.options && rule.use.options.babelrc === false
    );
    // Add your own `my-library`
    webComponentsRule.test.push(new RegExp(`node_modules(\\/|\\\\)my-library(.*)\\.js$`));

    return config;
  },
};

export default config;
```
