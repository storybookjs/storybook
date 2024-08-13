```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  stories: [],
  addons: [
    // Other Storybook addons
    '@storybook/addon-coverage', //👈 Registers the addon
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework and builder you are using (e.g., react-webpack5, vue3-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  stories: [],
  addons: [
    // Other Storybook addons
    '@storybook/addon-coverage', //👈 Registers the addon
  ],
};

export default config;
```
