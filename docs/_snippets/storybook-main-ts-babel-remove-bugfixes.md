```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
import path from 'path';

export default {
  // Replace your-framework with the framework you are using, e.g. react-webpack5, nextjs, angular, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  features: {
    babelRemoveBugfixes: true
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
import path from 'path';
// Replace your-framework with the framework you are using, e.g. react-webpack5, nextjs, angular, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  features: {
    babelRemoveBugfixes: true
  },
};

export default config;
```
