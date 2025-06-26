```js filename=".storybook/main.js" renderer="common" language="js"
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const getAbsolutePath = (packageName) =>
  dirname(fileURLToPath(import.meta.resolve(join(packageName, 'package.json'))));

export default {
  framework: {
    // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-docs'),
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const getAbsolutePath = (packageName) =>
  dirname(fileURLToPath(import.meta.resolve(join(packageName, 'package.json'))));

const config: StorybookConfig = {
  framework: {
    // Replace your-framework with the same one you've imported above.
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-docs'),
  ],
};

export default config;
```
