```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  viteFinal: async (config, options) => {
    // Update config here
    return config;
  },
  webpackFinal: async (config, options) => {
    // Change webpack config
    return config;
  },
  babel: async (config, options) => {
    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, angular, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  viteFinal: async (config, options) => {
    // Update config here
    return config;
  },
  webpackFinal: async (config, options) => {
    // Change webpack config
    return config;
  },
  babel: async (config, options) => {
    return config;
  },
};

export default config;
```
