```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', '../src/**/*.demo.@(js|jsx|mjs|ts|tsx)'],
  experimental_indexers: async (existingIndexers = []) => {
    const csfIndexer = existingIndexers.find((indexer) => indexer.test.test('Widget.stories.tsx'));

    if (!csfIndexer) {
      throw new Error('Could not find a CSF indexer to handle .demo files.');
    }

    return [...existingIndexers, { ...csfIndexer, test: /\.demo\.(m?js|ts)x?$/ }];
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', '../src/**/*.demo.@(js|jsx|mjs|ts|tsx)'],
  experimental_indexers: async (existingIndexers = []) => {
    const csfIndexer = existingIndexers.find((indexer) => indexer.test.test('Widget.stories.tsx'));

    if (!csfIndexer) {
      throw new Error('Could not find a CSF indexer to handle .demo files.');
    }

    return [...existingIndexers, { ...csfIndexer, test: /\.demo\.(m?js|ts)x?$/ }];
  },
};

export default config;
```
