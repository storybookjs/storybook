```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
import { fileURLToPath } from 'node:url';

export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
import { fileURLToPath } from 'node:url';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: '@storybook/web-components-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: '@storybook/web-components-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-styling-webpack',
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  implementation: fileURLToPath(import.meta.resolve('postcss')),
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
```
