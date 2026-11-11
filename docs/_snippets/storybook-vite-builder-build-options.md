```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');

    return mergeConfig(config, {
      build: {
        chunkSizeWarningLimit: 1024,
      },
    });
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');

    return mergeConfig(config, {
      build: {
        chunkSizeWarningLimit: 1024,
      },
    });
  },
};

export default config;
```
