```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => {
    return {
      ...config,
      // Apply your custom SWC configuration
    };
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
import type { Options } from '@swc/core';
// Replace your-framework with the webpack-based framework you are using (e.g., react-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config: Options, options): Options => {
    return {
      ...config,
      // Apply your custom SWC configuration
    };
  },
};

export default config;
```

