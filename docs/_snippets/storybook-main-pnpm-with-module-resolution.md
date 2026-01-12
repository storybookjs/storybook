```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const getAbsolutePath = (packageName) =>
  dirname(fileURLToPath(import.meta.resolve(`${packageName}/package.json`)));

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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const getAbsolutePath = (packageName: string) =>
  dirname(fileURLToPath(import.meta.resolve(`${packageName}/package.json`)));

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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

const getAbsolutePath = (packageName: string) =>
  dirname(fileURLToPath(import.meta.resolve(join(packageName, 'package.json'))));

export default defineMain({
  framework: {
    // Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-docs'),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

const getAbsolutePath = (packageName) =>
  dirname(fileURLToPath(import.meta.resolve(join(packageName, 'package.json'))));

export default defineMain({
  framework: {
    name: getAbsolutePath('@storybook/your-framework'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-docs'),
  ],
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/vue3-vite/node';

const getAbsolutePath = (packageName: string) =>
  dirname(fileURLToPath(import.meta.resolve(join(packageName, 'package.json'))));

export default defineMain({
  framework: {
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-docs'),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/vue3-vite/node';

const getAbsolutePath = (packageName) =>
  dirname(fileURLToPath(import.meta.resolve(join(packageName, 'package.json'))));

export default defineMain({
  framework: {
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {},
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    //👇 Use getAbsolutePath when referencing Storybook's addons and frameworks
    getAbsolutePath('@storybook/addon-docs'),
  ],
});
```
