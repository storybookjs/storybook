```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          include: ['**/stories/**'],
          exclude: ['**/exampleDirectory/**'],
          excludeNodeModules: true,
        },
      },
    },
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// For Vite support add the following import
// import type { AddonOptionsVite } from '@storybook/addon-coverage';

import type { AddonOptionsBabel } from '@storybook/addon-coverage';

// Replace your-framework with the framework and builder you are using (e.g., react-webpack5, vue3-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const coverageConfig: AddonOptionsBabel = {
  include: ['**/stories/**'],
  exclude: ['**/exampleDirectory/**'],
  excludeNodeModules: true,
};

const config: StorybookConfig = {
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          ...coverageConfig,
        },
      },
    },
  ],
};

export default config;
```
