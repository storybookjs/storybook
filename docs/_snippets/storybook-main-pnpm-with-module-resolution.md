```js filename=".storybook/main.js" renderer="common" language="js"
import path from 'path';

const getAbsolutePath = (packageName) =>
  path.dirname(require.resolve(path.join(packageName, 'package.json')));

export default {
  framework: {
    // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-essentials'),
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

import path from 'path';

const getAbsolutePath = (packageName: string): any =>
  path.dirname(require.resolve(path.join(packageName, 'package.json')));

const config: StorybookConfig = {
  framework: {
    // Replace your-framework with the same one you've imported above.
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-essentials'),
  ],
};

export default config;
```
