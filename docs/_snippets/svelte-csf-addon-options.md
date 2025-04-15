```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // Other configuration
  addons: [
    {
      name: '@storybook/addon-svelte-csf',
      options: {
        legacyTemplate: true, // Enables the legacy template syntax
      },
    },
  ],
};
```

```js filename=".storybook/main.ts" renderer="svelte" language="ts"
// Replace your-framework with the name of your Svelte framework
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // Other configuration
  addons: [
    {
      name: '@storybook/addon-svelte-csf',
      options: {
        legacyTemplate: true, // Enables the legacy template syntax
      },
    },
  ],
};
export default config;
```
