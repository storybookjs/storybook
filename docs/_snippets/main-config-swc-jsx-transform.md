```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
  framework: {
    name: '@storybook/your-framework',
    options: {
      builder: {
        useSWC: true, // This flag is automatically set by Storybook for all new Webpack5 projects (except Angular) in Storybook 7.6
      },
    },
  },
  swc: (config, options) => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the webpack-based framework you are using (e.g., react-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {
      builder: {
        useSWC: true, // This flag is automatically set by Storybook for all new Webpack5 projects (except Angular) in Storybook 7.6
      },
    },
  },
  swc: (config, options) => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
};

export default config;
```
