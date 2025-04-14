```ts filename=".storybook/main.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config, options) {
    // Add your configuration here
    return config;
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config, options) {
    // Add your configuration here
    return config;
  },
};

export default config;
```
