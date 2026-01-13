```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="With Webpack (CSF 3)"
export default {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, nextjs, angular)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
};
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="With Vite (CSF 3)"
import graphql from 'vite-plugin-graphql-loader';

export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), graphql()],
    };
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="With Webpack (CSF 3)"
// Replace your-framework with the framework you are using (e.g., react-webpack5, nextjs, angular)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="With Vite (CSF 3)"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';
import graphql from 'vite-plugin-graphql-loader';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), graphql()],
    };
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="With Webpack (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-webpack5, nextjs)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="With Webpack (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-webpack5, nextjs)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="With Vite (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import graphql from 'vite-plugin-graphql-loader';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), graphql()],
    };
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="With Vite (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import graphql from 'vite-plugin-graphql-loader';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), graphql()],
    };
  },
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="With Webpack (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="angular" language="js" tabTitle="With Webpack (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
});
```
