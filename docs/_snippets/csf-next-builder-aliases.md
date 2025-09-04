```ts filename=".storybook/main.js|ts" renderer="common" language="ts" tabTitle="Vite"
import path from 'path';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs-vite, vue3-vite, etc.
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...rest of config
  async viteFinal(config) {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve?.alias,
        '@': path.resolve(__dirname, './'),
      };
    }

    return config;
  },
});
```

```ts filename=".storybook/main.js|ts" renderer="common" language="ts" tabTitle="Webpack"
import path from 'path';
// Replace your-framework with the framework you are using, e.g. react-webpack, nextjs, angular, etc.
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...rest of config
  async webpackFinal(config) {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve?.alias,
        '@$': path.resolve(__dirname, './'),
      };
    }

    return config;
  },
});
```
