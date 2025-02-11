<!-- TODO: Vet this example for CSF Next-->

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
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

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import path from 'path';

const getAbsolutePath = (packageName) =>
  path.dirname(require.resolve(path.join(packageName, 'package.json')));

export default defineMain({
  framework: {
    // Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-essentials'),
  ],
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import path from 'path';

const getAbsolutePath = (packageName: string): any =>
  path.dirname(require.resolve(path.join(packageName, 'package.json')));

export default defineMain({
  framework: {
    // Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-essentials'),
  ],
});
```
