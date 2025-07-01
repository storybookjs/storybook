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
        },
      },
    },
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// For Vite support add the following import
// import type { AddonOptionsVite } from '@storybook/addon-coverage';

import type { AddonOptionsWebpack } from '@storybook/addon-coverage';

// Replace your-framework with the framework and builder you are using (e.g., react-webpack5, vue3-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const coverageConfig: AddonOptionsWebpack = {
  istanbul: {
    include: ['**/stories/**'],
    exclude: ['**/exampleDirectory/**'],
  },
};

const config: StorybookConfig = {
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: coverageConfig,
    },
  ],
};

export default config;
```
