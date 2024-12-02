```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    // Other Storybook addons
    '@storybook/addon-svelte-csf',
  ],
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
// Replace your-framework with the name of your Svelte framework
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|svelte)'],
  addons: [
    // Other Storybook addons
    '@storybook/addon-svelte-csf',
  ],
};

export default config;
```
