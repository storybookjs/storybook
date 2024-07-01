```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    // Other Storybook addons
    '@storybook/addon-designs', // 👈 Addon is registered here
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    // Other Storybook addons
    '@storybook/addon-designs', // 👈 Addon is registered here
  ],
};

export default config;
```

