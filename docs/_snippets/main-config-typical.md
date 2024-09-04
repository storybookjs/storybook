```js filename=".storybook/main.js" renderer="common" language="js"
const config = {
  // Required
  // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  // Optional
  addons: ['@storybook/addon-essentials'],
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
};
export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // Required
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  // Optional
  addons: ['@storybook/addon-essentials'],
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
};

export default config;
```

